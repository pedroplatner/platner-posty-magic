import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { PostStatus, PostTipo } from "@/lib/supabase";

const statusMap: Record<PostStatus, { label: string; cls: string }> = {
  agendado: { label: "Agendado", cls: "bg-primary/15 text-primary border-primary/30" },
  publicado: { label: "Publicado", cls: "bg-success/15 text-success border-success/30" },
  rascunho: { label: "Rascunho", cls: "bg-warning/15 text-warning border-warning/30" },
  processando: { label: "Processando", cls: "bg-info/15 text-info border-info/30" },
  erro: { label: "Erro", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function StatusBadge({ status, errorMsg }: { status: PostStatus; errorMsg?: string | null }) {
  if (status === "processando") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border", statusMap.processando.cls)}>
        <Loader2 className="h-3 w-3 animate-spin" /> Processando
      </span>
    );
  }
  const m = statusMap[status];
  return (
    <span
      title={status === "erro" ? errorMsg ?? undefined : undefined}
      className={cn("inline-flex items-center text-xs px-2.5 py-1 rounded-full border", m.cls)}
    >
      {m.label}
    </span>
  );
}

const tipoMap: Record<PostTipo, string> = {
  feed: "Feed",
  story: "Story",
  carrossel: "Carrossel",
};

export function TipoBadge({ tipo }: { tipo: PostTipo }) {
  return (
    <span className="inline-flex items-center text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
      {tipoMap[tipo]}
    </span>
  );
}
