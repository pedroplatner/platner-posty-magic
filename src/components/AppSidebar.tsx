import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Calendar, PlusSquare, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendario", label: "Calendário", icon: Calendar },
  { to: "/novo-post", label: "Novo Post", icon: PlusSquare },
  { to: "/fila", label: "Fila", icon: ListOrdered },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center font-display font-bold text-primary-foreground">P</div>
          <div>
            <div className="font-display font-semibold text-base leading-tight">Platner.IG</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Scheduler</div>
          </div>
        </div>
      </div>
      <nav className="p-3 flex-1 space-y-1">
        {items.map((it) => {
          const active = path === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-secondary hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground">
        @platnersystem
      </div>
    </aside>
  );
}
