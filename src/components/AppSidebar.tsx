import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Calendar, PlusSquare, ListOrdered, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth, signOut } from "@/lib/auth";
import { toast } from "sonner";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendario", label: "Calendário", icon: Calendar },
  { to: "/novo-post", label: "Novo Post", icon: PlusSquare },
  { to: "/fila", label: "Fila", icon: ListOrdered },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={cn(
        "shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("py-6 border-b border-sidebar-border flex items-center", collapsed ? "px-3 justify-center" : "px-6")}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-primary flex items-center justify-center font-display font-bold text-primary-foreground">P</div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-semibold text-base leading-tight truncate">Platner.IG</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Scheduler</div>
            </div>
          )}
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
              title={collapsed ? it.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                collapsed && "justify-center",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-secondary hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && it.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-3 h-9 rounded-lg border border-sidebar-border text-sidebar-foreground/70 hover:bg-secondary hover:text-sidebar-foreground flex items-center justify-center gap-2 text-xs transition-colors"
        title={collapsed ? "Expandir menu" : "Minimizar menu"}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Minimizar</>}
      </button>
      <button
        onClick={handleLogout}
        title={collapsed ? "Sair" : undefined}
        className={cn(
          "mx-3 mb-2 h-9 rounded-lg border border-sidebar-border text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center gap-2 text-xs transition-colors",
        )}
      >
        <LogOut className="h-4 w-4" />
        {!collapsed && "Sair"}
      </button>
      {!collapsed && user?.email && (
        <div className="px-4 pb-4 text-xs text-muted-foreground truncate" title={user.email}>{user.email}</div>
      )}
    </aside>
  );
}
