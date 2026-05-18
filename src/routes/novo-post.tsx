import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy: NewPostForm carrega dnd-kit, calendar, date-fns-tz — pesado.
const NewPostForm = lazy(() =>
  import("@/components/NewPostForm").then((m) => ({ default: m.NewPostForm }))
);

export const Route = createFileRoute("/novo-post")({
  validateSearch: (s: Record<string, unknown>) => ({ tema: (s.tema as string) || "", id: (s.id as string) || "" }),
  component: NovoPost,
  ssr: false,
});

function NovoPost() {
  const { tema, id } = Route.useSearch();
  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-semibold mb-6">
        {id ? "Editar Post" : "Novo Post"}
      </h1>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        }
      >
        <NewPostForm initialLegenda={tema} editId={id || undefined} />
      </Suspense>
    </div>
  );
}
