import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase, type PostInstagram, type PostMidia, type PostTipo, TIMEZONE } from "@/lib/supabase";
import { uploadImage, deleteStoragePaths } from "@/lib/storage";
import { buildSPDate } from "@/lib/format";
import { InstagramPreview } from "./InstagramPreview";
import { toast } from "sonner";
import { Upload, X, GripVertical, Loader2, CalendarIcon, Sparkles, Zap, Clock, Brain } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { gerarLegenda, gerarHashtags } from "@/lib/ai.functions";
import { format as fmtTz, toZonedTime, fromZonedTime } from "date-fns-tz";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { useQuery } from "@tanstack/react-query";
import { callInsights, type IGInsightsResponse } from "@/lib/insights";

type HorarioMode = "agora" | "manual" | "ia";

const DAY_MAP: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 0,
};
const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface ImgItem {
  id: string;
  file?: File;
  preview: string;
  existingPath?: string;
}

interface Props {
  initialLegenda?: string;
  editId?: string;
}

export function NewPostForm({ initialLegenda = "", editId }: Props) {
  const navigate = useNavigate();
  const isEdit = !!editId;
  const [loading, setLoading] = useState(isEdit);
  const [tipo, setTipo] = useState<PostTipo>("feed");
  const [imgs, setImgs] = useState<ImgItem[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [legenda, setLegenda] = useState(initialLegenda);
  const [hashtags, setHashtags] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [horarioMode, setHorarioMode] = useState<HorarioMode>("manual");
  const [saving, setSaving] = useState(false);
  const [aiLegenda, setAiLegenda] = useState(false);
  const [aiHashtags, setAiHashtags] = useState(false);
  const callGerarLegenda = useServerFn(gerarLegenda);
  const callGerarHashtags = useServerFn(gerarHashtags);

  // Sugestão IA: busca top 3 horários
  const iaQ = useQuery({
    queryKey: ["ig", "online_followers"],
    queryFn: () => callInsights<IGInsightsResponse>("insights", {
      metric: "online_followers", period: "lifetime",
    }),
    staleTime: 30 * 60 * 1000,
    retry: 0,
    enabled: horarioMode === "ia",
  });

  const iaPeaks = (() => {
    const mat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const values = iaQ.data?.data?.[0]?.values ?? [];
    for (const v of values) {
      const anyV = v as unknown as { value: unknown };
      if (typeof anyV.value === "object" && anyV.value !== null) {
        const date = v.end_time ? new Date(v.end_time) : null;
        if (!date) continue;
        const dow = (date.getDay() + 6) % 7;
        Object.entries(anyV.value as Record<string, number>).forEach(([h, n]) => {
          const hour = Number(h);
          if (Number.isFinite(hour)) mat[dow][hour] += n;
        });
      }
    }
    const td = iaQ.data?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const r of td) {
      const [dayKey, hourKey] = r.dimension_values;
      const d = DAY_MAP[dayKey];
      const h = Number(hourKey);
      if (d !== undefined && Number.isFinite(h)) mat[d][h] += r.value;
    }
    const flat: Array<{ d: number; h: number; v: number }> = [];
    mat.forEach((row, d) => row.forEach((v, h) => flat.push({ d, h, v })));
    return flat.sort((a, b) => b.v - a.v).filter(p => p.v > 0).slice(0, 3);
  })();

  function selectIaPeak(d: number, h: number) {
    // Calcula próxima ocorrência do dia da semana d
    const now = toZonedTime(new Date(), TIMEZONE);
    const todayDow = now.getDay(); // 0=Dom
    let diff = d - todayDow;
    if (diff <= 0) diff += 7;
    const target = addDays(now, diff);
    const dateStr = fmtTz(target, "yyyy-MM-dd", { timeZone: TIMEZONE });
    const timeStr = String(h).padStart(2, "0") + ":00";
    setData(dateStr);
    setHora(timeStr);
  }

  async function handleGerarLegenda() {
    const tema = legenda.trim() || initialLegenda.trim();
    if (!tema) return toast.error("Escreva um tema/ideia primeiro na legenda");
    setAiLegenda(true);
    try {
      const r = await callGerarLegenda({ data: { tema, tipo } });
      setLegenda(r.legenda);
      toast.success("Legenda gerada");
    } catch (e: any) {
      toast.error(e?.message?.includes("402") ? "Sem créditos de IA na workspace" : "Falha ao gerar legenda");
    } finally { setAiLegenda(false); }
  }

  async function handleGerarHashtags() {
    const ctx = (legenda + " " + hashtags).trim();
    if (!ctx) return toast.error("Escreva a legenda primeiro");
    setAiHashtags(true);
    try {
      const r = await callGerarHashtags({ data: { contexto: ctx } });
      setHashtags(r.hashtags);
      toast.success("Hashtags geradas");
    } catch (e: any) {
      toast.error(e?.message?.includes("402") ? "Sem créditos de IA na workspace" : "Falha ao gerar hashtags");
    } finally { setAiHashtags(false); }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data: post } = await supabase.from("posts_instagram").select("*").eq("id", editId).single();
      if (!post) { toast.error("Post não encontrado"); navigate({ to: "/fila" }); return; }
      const p = post as PostInstagram;
      setTipo(p.tipo_post);
      setLegenda(p.legenda ?? "");
      setHashtags(p.hashtags ?? "");
      if (p.data_publicacao) {
        const d = toZonedTime(new Date(p.data_publicacao), TIMEZONE);
        setData(fmtTz(d, "yyyy-MM-dd", { timeZone: TIMEZONE }));
        setHora(fmtTz(d, "HH:mm", { timeZone: TIMEZONE }));
      }
      if (p.tipo_post === "carrossel") {
        const { data: m } = await supabase.from("post_midias").select("*").eq("post_id", editId).order("ordem");
        setImgs(((m as PostMidia[]) ?? []).map((x) => ({
          id: crypto.randomUUID(), preview: x.imagem_url, existingPath: x.storage_path,
        })));
      } else if (p.imagem_url && p.storage_path) {
        setImgs([{ id: crypto.randomUUID(), preview: p.imagem_url, existingPath: p.storage_path }]);
      }
      setLoading(false);
    })();
  }, [editId, navigate]);

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
      setImgs((prev) => {
        prev.forEach((i) => { if (i.existingPath) setRemovedPaths((r) => [...r, i.existingPath!]); });
        return [{ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }];
      });
    }
  }

  function changeTipo(t: PostTipo) {
    setTipo(t);
    setImgs((prev) => {
      prev.forEach((i) => { if (i.existingPath) setRemovedPaths((r) => [...r, i.existingPath!]); });
      return [];
    });
  }

  function removeImg(id: string) {
    setImgs((p) => {
      const removed = p.find((i) => i.id === id);
      if (removed?.existingPath) setRemovedPaths((r) => [...r, removed.existingPath!]);
      return p.filter((i) => i.id !== id);
    });
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
    if (tipo === "carrossel" && imgs.length < 2) return toast.error("Carrossel precisa de no mínimo 2 imagens");

    let dataPub: string;

    if (horarioMode === "agora") {
      const nowUtc = new Date(Date.now() + 60_000);
      dataPub = nowUtc.toISOString();
    } else {
      if (!data || !hora) return toast.error("Data e horário são obrigatórios");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return toast.error("Horário inválido (HH:MM)");
      dataPub = buildSPDate(data, hora);
    }

    setSaving(true);
    try {
      const resolved: { url: string; path: string }[] = [];
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        if (img.existingPath) {
          resolved.push({ url: img.preview, path: img.existingPath });
        } else if (img.file) {
          const suffix = tipo === "carrossel" ? String(i + 1) : undefined;
          const u = await uploadImage(img.file, suffix);
          resolved.push(u);
        }
      }
      const first = resolved[0];

      let postId: string;

      if (isEdit) {
        const { error } = await supabase.from("posts_instagram").update({
          legenda, hashtags, data_publicacao: dataPub, status, tipo_post: tipo,
          imagem_url: first.url, storage_path: first.path,
        }).eq("id", editId!);
        if (error) throw error;
        await supabase.from("post_midias").delete().eq("post_id", editId!);
        if (tipo === "carrossel") {
          const rows = resolved.map((u, i) => ({
            post_id: editId!, imagem_url: u.url, storage_path: u.path, ordem: i + 1,
          }));
          const { error: e2 } = await supabase.from("post_midias").insert(rows);
          if (e2) throw e2;
        }
        if (removedPaths.length) await deleteStoragePaths(removedPaths);
        postId = editId!;
      } else {
        const { data: post, error } = await supabase
          .from("posts_instagram")
          .insert({
            imagem_url: first.url, storage_path: first.path,
            legenda, hashtags, data_publicacao: dataPub, status, tipo_post: tipo,
          })
          .select().single();
        if (error) throw error;
        if (tipo === "carrossel") {
          const rows = resolved.map((u, i) => ({
            post_id: post.id, imagem_url: u.url, storage_path: u.path, ordem: i + 1,
          }));
          const { error: e2 } = await supabase.from("post_midias").insert(rows);
          if (e2) throw e2;
        }
        postId = post.id;
      }

      // Dispara webhook n8n se agendado
      if (status === "agendado") {
        const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              post_id: postId,
              data_publicacao: dataPub,
              tipo_post: tipo,
              legenda,
              imagem_url: first.url,
            }),
          }).catch(() => {}); // fire-and-forget — n8n tem cron como fallback
        }
      }

      toast.success(isEdit ? "Post atualizado" : (status === "agendado" ? "Post agendado!" : "Rascunho salvo"));
      navigate({ to: "/fila" });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const selectedDate = data ? new Date(`${data}T12:00:00`) : undefined;
  const showCalendar = horarioMode !== "agora" && !(horarioMode === "ia" && hora);

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
          <div className="flex items-center justify-between mb-2 gap-2">
            <Label htmlFor="legenda">Legenda</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGerarLegenda}
                disabled={aiLegenda}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                title="Gerar legenda com IA (use o tema atual)"
              >
                {aiLegenda ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Gerar com IA
              </button>
              <span className={cn(
                "text-[11px]",
                legenda.length > 2200 ? "text-destructive font-medium" : "text-muted-foreground"
              )}>
                {legenda.length} / 2200
              </span>
            </div>
          </div>
          <Textarea
            id="legenda"
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            rows={4}
            placeholder="Escreva a legenda do post..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2 gap-2">
            <Label htmlFor="hashtags">Hashtags</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGerarHashtags}
                disabled={aiHashtags}
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                title="Sugerir hashtags com base na legenda"
              >
                {aiHashtags ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Sugerir com IA
              </button>
              {(() => {
                const count = (hashtags.match(/#\w+/g) || []).length;
                return (
                  <span className={cn(
                    "text-[11px]",
                    count > 30 ? "text-destructive font-medium" : "text-muted-foreground"
                  )}>
                    {count} / 30
                  </span>
                );
              })()}
            </div>
          </div>
          <Textarea
            id="hashtags"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            rows={2}
            placeholder="#exemplo #hashtag"
          />
        </div>

        {/* Agendamento */}
        <div className="space-y-3">
          <Label>Agendamento</Label>

          {/* Tabs de modo */}
          <div className="flex gap-1 p-1 bg-card border border-border rounded-lg w-fit">
            <ModeTab
              active={horarioMode === "agora"}
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Agora"
              onClick={() => setHorarioMode("agora")}
            />
            <ModeTab
              active={horarioMode === "manual"}
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Manual"
              onClick={() => setHorarioMode("manual")}
            />
            <ModeTab
              active={horarioMode === "ia"}
              icon={<Brain className="h-3.5 w-3.5" />}
              label="Sugestão IA"
              onClick={() => setHorarioMode("ia")}
            />
          </div>

          {/* Conteúdo da tab */}
          {horarioMode === "agora" && (
            <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <Zap className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium">Publicar agora</p>
                <p className="text-xs text-muted-foreground">+1 min para upload seguro</p>
              </div>
            </div>
          )}

          {horarioMode === "manual" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !data && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : "Selecione uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(d) => d && setData(format(d, "yyyy-MM-dd"))}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Horário</Label>
                <Input
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  step={300}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          {horarioMode === "ia" && (
            <div className="space-y-3">
              {iaQ.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando melhores horários...
                </div>
              )}
              {(iaQ.error || (!iaQ.isLoading && iaPeaks.length === 0)) && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
                  Insights indisponíveis — use horário manual
                </div>
              )}
              {iaPeaks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Melhores horários para seus seguidores:</p>
                  <div className="flex gap-2 flex-wrap">
                    {iaPeaks.map((p, i) => {
                      const medal = ["🥇", "🥈", "🥉"][i];
                      const dow = p.d; // 0=Dom,1=Seg...6=Sáb
                      const isSelected = hora === String(p.h).padStart(2, "0") + ":00";
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectIaPeak(dow, p.h)}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm border transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-card border-border hover:border-primary/50"
                          )}
                        >
                          {medal} {DAYS_PT[dow]} {String(p.h).padStart(2, "0")}h
                        </button>
                      );
                    })}
                  </div>
                  {hora && data && (
                    <p className="text-xs text-muted-foreground">
                      Agendado para: {format(new Date(`${data}T12:00:00`), "dd/MM", { locale: ptBR })} às {hora}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {!isEdit && (
            <Button variant="secondary" disabled={saving} onClick={() => save("rascunho")}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Rascunho
            </Button>
          )}
          <Button disabled={saving} onClick={() => save("agendado")}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isEdit ? "Salvar alterações" : "Agendar Post"}
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

function ModeTab({
  active, icon, label, onClick,
}: {
  active: boolean; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
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
