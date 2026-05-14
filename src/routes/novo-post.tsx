import { createFileRoute } from "@tanstack/react-router";
import { NewPostForm } from "@/components/NewPostForm";

export const Route = createFileRoute("/novo-post")({
  validateSearch: (s: Record<string, unknown>) => ({ tema: (s.tema as string) || "" }),
  component: NovoPost,
});

function NovoPost() {
  const { tema } = Route.useSearch();
  return (
    <div className="max-w-6xl">
      <NewPostForm initialLegenda={tema} />
    </div>
  );
}
