import { useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Clock } from "lucide-react";
import { format as fmtTz } from "date-fns-tz";
import { TIMEZONE } from "@/lib/supabase";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/calendario": "Calendário",
  "/novo-post": "Novo Post",
  "/fila": "Fila",
};

export function AppHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const title = titles[path] ?? "Platner.IG";
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const horario = now ? fmtTz(now, "dd/MM/yyyy HH:mm:ss", { timeZone: TIMEZONE }) : "—";

  return (
    <header className="h-20 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">@platnersystem</p>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs"
          title="Fuso horário: America/Sao_Paulo (BRT)"
        >
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium tabular-nums">{horario}</span>
          <span className="text-muted-foreground">BRT</span>
        </div>
        <Link to="/novo-post">
          <Button className="gap-2 font-medium shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" /> Criar Post
          </Button>
        </Link>
      </div>
    </header>
  );
}
