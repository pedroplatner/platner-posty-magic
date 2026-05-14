import { useRouterState, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/calendario": "Calendário",
  "/novo-post": "Novo Post",
  "/fila": "Fila",
};

export function AppHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[path] ?? "Platner.IG";
  return (
    <header className="h-20 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">@platnersystem</p>
      </div>
      <Link to="/novo-post">
        <Button className="gap-2 font-medium shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> Criar Post
        </Button>
      </Link>
    </header>
  );
}
