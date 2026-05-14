import { useEffect, useState } from "react";
import { supabase, type PostInstagram, type PostMidia, type PostTipo } from "@/lib/supabase";
import { uploadImage, deleteStoragePaths } from "@/lib/storage";
import { buildSPDate } from "@/lib/format";
import { toZonedTime } from "date-fns-tz";
import { format as fmt } from "date-fns-tz";
import { TIMEZONE } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

const HORARIOS = ["11:00", "12:00", "13:00", "18:00", "19:00", "20:00"];

interface Props {
  post: PostInstagram;
  onClose: () => void;
}

export function EditPostDialog({ post, onClose }: Props) {
  const [tipo, setTipo] = useState<PostTipo>(post.tipo_post);
  const [legenda, setLegenda] = useState(post.legenda ?? "");
  const [hashtags, setHashtags] = useState(post.hashtags ?? "");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [existing, setExisting] = useState<{ url: string; path: string }[]>([]);
  const [newFiles, setNewFiles] = useState<{ id: string; file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post.data_publicacao) {
      const d = toZonedTime(new Date(post.data_publicacao), TIMEZONE);
      setData(fmt(d, "yyyy-MM-dd", { timeZone: TIMEZONE }));
      setHora(fmt(d, "HH:mm", { timeZone: TIMEZONE }));
    }
    (async () => {
      if (post.tipo_post === "carrossel") {
        const { data: m } = await supabase
          .from("post_midias").select("*").eq("post_id", post.id).order("ordem");
        setExisting((m as PostMidia[] ?? []).map((x) => ({ url: x.imagem_url, path: x.storage_path })));
      } else if (post.imagem_url && post.storage_path) {
        setExisting([{ url: post.imagem_url, path: post.storage_path }]);
      }
    })();
  }, [post]);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).map((f) => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }));
    if (tipo === "carrossel") setNewFiles((p) => [...p, ...arr].slice(0, 10));
    else { setNewFiles([arr[0]]); setExisting([]); }
  }

  async function save() {
    if (!legenda.trim()) return toast.error("Legenda é obrigatória");
    if (!data || !hora) return toast.error("Data/hora obrigatórios");
    const totalImgs = existing.length + newFiles.length;
    if (totalImgs === 0) return toast.error("Pelo menos uma imagem");
    if (tipo === "carrossel" && totalImgs < 2) return toast.error("Carrossel precisa de no mínimo 2 imagens");

    setSaving(true);
    try {
      // Upload new files
      const uploaded: { url: string; path: string }[] = [];
      for (let i = 0; i < newFiles.length; i++) {
        const u = await uploadImage(newFiles[i].file, tipo === "carrossel" ? String(existing.length + i + 1) : undefined);
        uploaded.push(u);
      }
      const all = [...existing, ...uploaded];
      const first = all[0];
      const dataPub = buildSPDate(data, hora);

      const { error } = await supabase.from("posts_instagram").update({
        legenda, hashtags, data_publicacao: dataPub, tipo_post: tipo,
        imagem_url: first.url, storage_path: first.path,
      }).eq("id", post.id);
      if (error) throw error;

      // Reset midias when carrossel — delete removed paths
      if (post.tipo_post === "carrossel" || tipo === "carrossel") {
        const { data: oldM } = await supabase.from("post_midias").select("storage_path").eq("post_id", post.id);
        const oldPaths = (oldM ?? []).map((m: any) => m.storage_path);
        const keepPaths = new Set(all.map((a) => a.path));
        const toRemove = oldPaths.filter((p: string) => !keepPaths.has(p));
        await supabase.from("post_midias").delete().eq("post_id", post.id);
        if (toRemove.length) await deleteStoragePaths(toRemove);
        if (tipo === "carrossel") {
          await supabase.from("post_midias").insert(
            all.map((a, i) => ({ post_id: post.id, imagem_url: a.url, storage_path: a.path, ordem: i + 1 }))
          );
        }
      }

      toast.success("Post atualizado");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function changeTipo(t: PostTipo) {
    setTipo(t);
    if (t !== "carrossel") {
      setExisting((p) => p.slice(0, 1));
      setNewFiles((p) => p.slice(0, 1));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Editar Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="flex gap-2 p-1 bg-secondary rounded-lg w-fit">
            {(["feed","story","carrossel"] as PostTipo[]).map((t) => (
              <button key={t} onClick={() => changeTipo(t)}
                className={cn("px-4 py-1.5 rounded-md text-sm capitalize",
                  tipo === t ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {t}
              </button>
            ))}
          </div>

          <div>
            <Label className="mb-2 block">Imagens</Label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {existing.map((e, i) => (
                <div key={i} className="relative aspect-square rounded overflow-hidden border border-border">
                  <img src={e.url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setExisting((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {newFiles.map((f, i) => (
                <div key={f.id} className="relative aspect-square rounded overflow-hidden border border-primary/40">
                  <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setNewFiles((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline">
              <Upload className="h-4 w-4" /> Adicionar imagem
              <input type="file" accept="image/*" multiple={tipo === "carrossel"} className="hidden"
                onChange={(e) => handleFiles(e.target.files)} />
            </label>
          </div>

          <div>
            <Label>Legenda</Label>
            <Textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={3} className="mt-2" />
          </div>
          <div>
            <Label>Hashtags</Label>
            <Textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} rows={2} className="mt-2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-2" />
            </div>
            <div>
              <Label>Horário</Label>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {HORARIOS.map((h) => (
                  <button key={h} onClick={() => setHora(h)}
                    className={cn("py-1.5 rounded text-sm border",
                      hora === h ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground")}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
