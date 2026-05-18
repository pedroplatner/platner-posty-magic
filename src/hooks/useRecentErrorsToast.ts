import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/** Once per session: warn the user if any posts failed in the last hour. */
export function useRecentErrorsToast(enabled: boolean) {
  const navigate = useNavigate();
  const fired = useRef(false);

  useEffect(() => {
    if (!enabled || fired.current) return;
    fired.current = true;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    supabase
      .from("posts_instagram")
      .select("id", { count: "exact", head: true })
      .eq("status", "erro")
      .gte("updated_at", since)
      .then(({ count }) => {
        if (count && count > 0) {
          toast.error(`${count} post${count > 1 ? "s falharam" : " falhou"} na última hora`, {
            description: "Toque para ver detalhes",
            action: { label: "Ver histórico", onClick: () => navigate({ to: "/historico" }) },
            duration: 10000,
          });
        }
      });
  }, [enabled, navigate]);
}
