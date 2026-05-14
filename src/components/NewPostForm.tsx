import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase, type PostTipo } from "@/lib/supabase";
import { uploadImage } from "@/lib/storage";
import { buildSPDate } from "@/lib/format";
import { InstagramPreview } from "./InstagramPreview";
import { toast } from "sonner";
import { Upload, X, GripVertical, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";

const HORARIOS = ["11:00", "12:00", "13:00", "18:00", "19:00", "20:00"];

interface ImgItem {
  id: string;
  file?: File;
  preview: string;
}

interface Props {
  initialLegenda?: string;
}

export function NewPostForm({ initialLegenda = "" }: Props) {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<PostTipo>("feed");
  const [imgs, setImgs] = useState<ImgItem[]>([]);
  const [legenda, setLegenda] = useState(initialLegenda);
  const [hashtags, setHashtags] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const arr = Array.from(files);
    if (tipo === "carrossel") {
      setImgs((prev) => {
        const merged = [...prev, ...arr.map((f) => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }))];
        return merged.slice(0, 10);
      });
    } else {
      const f = arr[0];
      setImgs([{ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }]);
    }
  }

  function changeTipo(t: PostTipo) {
    setTipo(t);
    setImgs([]);
  }

  function removeImg(id: string) {
    setImgs((p) => p.filter((i) => i.id !== id));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setImgs((items) => {
      const oldIdx = items.findIndex((i) => i.id === active.id);
      const newIdx = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIdx, newIdx);
    });
  }

  async function save(status: "rascunho" | "agendado") {
    if (!imgs.length) return toast.error("Adicione pelo menos uma imagem");
    if (!legenda.trim()) return toast.error("Legenda é obrigatória");
    if (!data || !hora) return toast.error("Data e horário são obrigatórios");
    if (tipo === "carrossel" && imgs.length < 2) return toast.error("Carrossel precisa de no mínimo 2 imagens");

    setSaving(true);
    try {
      const dataPub = buildSPDate(data, hora);
      // Upload all
      const uploaded: { url: string; path: string }[] = [];
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (!img.file) continue;
        const suffix = tipo === "carrossel" ? String(i + 1) : undefined;
        const u = await uploadImage(img.file, suffix);
        uploaded.push(u);
      }

      const first = uploaded[0];
      const { data: post, error } = await supabase
        .from("posts_instagram")
        .insert({
          imagem_url: first.url,
          storage_path: first.path,
          legenda,
          hashtags,
          data_publicacao: dataPub,
          status,
          tipo_post: tipo,
        })
        .select()
        .single();
      if (error) throw error;

      if (tipo === "carrossel") {
        const rows = uploaded.map((u, i) => ({
          post_id: post.id,
          imagem_url: u.url,
          storage_path: u.path,
          ordem: i + 1,
        }));
        const { error: e2 } = await supabase.from("post_midias").insert(rows);
        if (e2) throw e2;
      }

      toast.success(status === "agendado" ? "Post agendado!" : "Rascunho salvo");
      navigate({ to: "/fila" });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-8">
      <div className="space-y-6">
        {/* Tipo */}
        <div className="flex gap-2 p-1 bg-card border border-border rounded-lg w-fit">
          {(["feed", "story", "carrossel"] as PostTipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeTipo(t)}
              className={cn(
                "px-5 py-2 rounded-md text-sm font-medium capitalize transition-colors",
                tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Upload */}
        <div>
          <Label className="mb-2 block">{tipo === "carrossel" ? "Imagens (2-10)" : "Imagem"}</Label>
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-10 px-4 cursor-pointer hover:border-primary/50 hover:bg-card/50 transition-colors"
          >
            <Upload className="h-6 w-6 text-muted-foreground mb-2" />
            <span className="text-sm">Clique para enviar</span>
            <span className="text-xs text-muted-foreground mt-1">
              {tipo === "carrossel" ? "Selecione 2 a 10 imagens" : "Uma imagem"}
            </span>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              multiple={tipo === "carrossel"}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>

          {imgs.length > 0 && (
            <div className="mt-4">
              {tipo === "carrossel" ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={imgs.map((i) => i.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-4 gap-2">
                      {imgs.map((img, i) => (
                        <SortableImg key={img.id} img={img} index={i + 1} onRemove={() => removeImg(img.id)} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                  <img src={imgs[0].preview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImg(imgs[0].id)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="legenda">Legenda</Label>
          <Textarea
            id="legenda"
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            rows={4}
            placeholder="Escreva a legenda do post..."
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="hashtags">Hashtags</Label>
          <Textarea
            id="hashtags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            rows={2}
            placeholder="#exemplo #hashtag"
            className="mt-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label>Horário</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {HORARIOS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHora(h)}
                  className={cn(
                    "py-2 rounded-md text-sm border transition-colors",
                    hora === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" disabled={saving} onClick={() => save("rascunho")}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Rascunho
          </Button>
          <Button disabled={saving} onClick={() => save("agendado")}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Agendar Post
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 self-start">
        <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">Preview</h3>
        <InstagramPreview tipo={tipo} images={imgs.map((i) => i.preview)} legenda={legenda} hashtags={hashtags} />
      </div>
    </div>
  );
}

function SortableImg({ img, index, onRemove }: { img: ImgItem; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
      <img src={img.preview} alt="" className="w-full h-full object-cover" />
      <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
        {index}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </button>
    </div>
  );
}
