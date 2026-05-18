import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, type PostInstagram } from "@/lib/supabase";
import { formatBR, truncate } from "@/lib/format";
import { StatusBadge, TipoBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/historico")({ component: HistoricoPage, ssr: false });

function HistoricoPage() {
  const [posts, setPosts] = useState<PostInstagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "publicado" | "erro">("todos");
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("posts_instagram")
        .select("id,imagem_url,legenda,data_publicacao,status,tipo_post,erro_msg,publicado_em,created_at,tentativas,max_tentativas")
        .in("status", ["publicado", "erro"])
        .order("publicado_em", { ascending: false, nullsFirst: false });
      setPosts((data ?? []) as unknown as PostInstagram[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("posts-hist")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts_instagram" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "todos") return posts;
    return posts.filter((p) => p.status === filter);
  }, [posts, filter]);

  const stats = useMemo(() => ({
    publicados: posts.filter((p) => p.status === "publicado").length,
    erros: posts.filter((p) => p.status === "erro").length,
  }), [posts]);

  async function retry(p: PostInstagram) {
    setRetrying(p.id);
    const { error } = await supabase
      .from("posts_instagram")
      .update({ status: "agendado", erro_msg: null, tentativas: 0 })
      .eq("id", p.id);
    setRetrying(null);
    if (error) return toast.error(error.message);
    toast.success("Post reenviado para a fila");
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-success/30 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-success/15 text-success flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-display font-semibold">{stats.publicados}</p>
              <p className="text-xs text-muted-foreground">Publicados</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-destructive/30 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-display font-semibold">{stats.erros}</p>
              <p className="text-xs text-muted-foreground">Falhas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(["todos", "publicado", "erro"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-1.5 text-sm rounded-full border capitalize transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "todos" ? "Todos" : f === "publicado" ? "Publicados" : "Falhas"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhum registro neste filtro</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl">
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                {p.imagem_url && <img src={p.imagem_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <TipoBadge tipo={p.tipo_post} />
                  <StatusBadge status={p.status} errorMsg={p.erro_msg} />
                  {p.tentativas != null && p.tentativas > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {p.tentativas}/{p.max_tentativas ?? 3} tentativas
                    </span>
                  )}
                </div>
                <p className="text-sm truncate">{truncate(p.legenda, 90)}</p>
                {p.status === "erro" && p.erro_msg && (
                  <p className="text-xs text-destructive mt-1.5 bg-destructive/10 border border-destructive/20 rounded px-2 py-1">
                    {p.erro_msg}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {p.status === "publicado" && p.publicado_em
                    ? `Publicado em ${formatBR(p.publicado_em, "dd/MM/yy 'às' HH:mm")}`
                    : `Agendado para ${formatBR(p.data_publicacao, "dd/MM/yy 'às' HH:mm")}`}
                </p>
              </div>
              {p.status === "erro" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retrying === p.id}
                  onClick={() => retry(p)}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", retrying === p.id && "animate-spin")} />
                  Reenviar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
