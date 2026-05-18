import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, type PostInstagram, type PostStatus } from "@/lib/supabase";
import { deleteStoragePaths } from "@/lib/storage";
import { formatBR, truncate } from "@/lib/format";
import { StatusBadge, TipoBadge } from "@/components/Badges";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Check } from "lucide-react";
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

export const Route = createFileRoute("/fila")({ component: FilaPage });

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
  const [filter, setFilter] = useState<"todos" | PostStatus>("todos");
  const [toDelete, setToDelete] = useState<PostInstagram | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("posts_instagram").select("*").order("data_publicacao", { ascending: true });
      setPosts(data ?? []);
    };
    load();
    const ch = supabase
      .channel("posts-fila")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts_instagram" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = filter === "todos" ? posts : posts.filter((p) => p.status === filter);

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
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-4 py-1.5 text-sm rounded-full border transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Nenhum post encontrado</p>
          <Button onClick={() => navigate({ to: "/novo-post" })}>Criar primeiro post</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors">
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0">
                {p.imagem_url && <img src={p.imagem_url} alt="" className="w-full h-full object-cover" />}
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
              <div className="flex gap-1 shrink-0">
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
          ))}
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
