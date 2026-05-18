import { createFileRoute } from "@tanstack/react-router";
import { NewPostForm } from "@/components/NewPostForm";

export const Route = createFileRoute("/novo-post")({
  validateSearch: (s: Record<string, unknown>) => ({
    tema: (s.tema as string) || "",
    id: (s.id as string) || "",
  }),
  component: NovoPost,
});

function NovoPost() {
  const { tema, id } = Route.useSearch();
  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-semibold mb-6">
        {id ? "Editar Post" : "Novo Post"}
      </h1>
      <NewPostForm initialLegenda={tema} editId={id || undefined} />
    </div>
  );
}
