import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, type PostInstagram, type PostStatus } from "@/lib/supabase";
import { deleteStoragePaths } from "@/lib/storage";
import { formatBR, truncate } from "@/lib/format";
import { StatusBadge, TipoBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Check, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/fila")({ component: FilaPage, ssr: false });

const FILTROS: { key: "todos" | PostStatus; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "agendado", label: "Agendados" },
  { key: "rascunho", label: "Rascunhos" },
  { key: "publicado", label: "Publicados" },
  { key: "erro", label: "Erro" },
];

function FilaPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostInstagram[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | PostStatus>("todos");
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<PostInstagram | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("posts_instagram")
        .select("id,imagem_url,storage_path,legenda,data_publicacao,status,tipo_post,erro_msg,publicado_em,created_at")
        .order("data_publicacao", { ascending: true });
      setPosts((data ?? []) as unknown as PostInstagram[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("posts-fila")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts_instagram" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: posts.length };
    posts.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [posts]);

  const filtered = useMemo(() => {
    const byStatus = filter === "todos" ? posts : posts.filter((p) => p.status === filter);
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((p) => (p.legenda ?? "").toLowerCase().includes(q));
  }, [posts, filter, search]);

  async function handleDelete() {
    if (!toDelete) return;
    try {
      const { data: midias } = await supabase
        .from("post_midias")
        .select("storage_path")
        .eq("post_id", toDelete.id);
      const paths = [
        ...(toDelete.storage_path ? [toDelete.storage_path] : []),
        ...((midias ?? []).map((m: any) => m.storage_path).filter(Boolean)),
      ];
      await supabase.from("post_midias").delete().eq("post_id", toDelete.id);
      const { error } = await supabase.from("posts_instagram").delete().eq("id", toDelete.id);
      if (error) throw error;
      await deleteStoragePaths(paths);
      toast.success("Post excluído");
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    } finally {
      setToDelete(null);
    }
  }

  async function approve(p: PostInstagram) {
    const { error } = await supabase.from("posts_instagram").update({ status: "agendado" }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Rascunho aprovado e agendado");
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const n = counts[f.key] ?? 0;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full border transition-colors inline-flex items-center gap-2",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                  active ? "bg-primary-foreground/20" : "bg-secondary text-foreground/70"
                )}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar na legenda..."
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md hover:bg-secondary flex items-center justify-center"
              title="Limpar"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-8 w-16 hidden sm:block" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {search ? `Nenhum post encontrado para "${search}"` : "Nenhum post encontrado"}
          </p>
          {!search && (
            <Button onClick={() => navigate({ to: "/novo-post" })}>Criar primeiro post</Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const editable = p.status === "agendado" || p.status === "rascunho" || p.status === "erro";
            const stop = (e: React.MouseEvent) => e.stopPropagation();
            return (
            <div
              key={p.id}
              role={editable ? "button" : undefined}
              tabIndex={editable ? 0 : undefined}
              onClick={() => editable && navigate({ to: "/novo-post", search: { id: p.id, tema: "" } as any })}
              className={cn(
                "flex items-center gap-4 p-4 bg-card border border-border rounded-xl transition-colors",
                editable ? "cursor-pointer hover:border-primary/50 hover:bg-card/80" : "hover:border-primary/30"
              )}
            >
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                {p.imagem_url && <img src={p.imagem_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <TipoBadge tipo={p.tipo_post} />
                  <StatusBadge status={p.status} errorMsg={p.erro_msg} />
                </div>
                <p className="text-sm truncate">{truncate(p.legenda, 80)}</p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-medium">{formatBR(p.data_publicacao, "dd/MM/yy")}</p>
                <p className="text-xs text-muted-foreground">{formatBR(p.data_publicacao, "HH:mm")}</p>
              </div>
              <div className="flex gap-1 shrink-0" onClick={stop}>
                {p.status === "rascunho" && (
                  <Button size="icon" variant="ghost" title="Aprovar e agendar" onClick={() => approve(p)}>
                    <Check className="h-4 w-4 text-success" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" title="Editar" onClick={() => navigate({ to: "/novo-post", search: { id: p.id, tema: "" } as any })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Excluir" onClick={() => setToDelete(p)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O post e todas as imagens serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
