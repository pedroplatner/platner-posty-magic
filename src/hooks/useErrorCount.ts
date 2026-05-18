import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Live count of posts in `erro` status. Subscribes to realtime changes. */
export function useErrorCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count: c } = await supabase
        .from("posts_instagram")
        .select("id", { count: "exact", head: true })
        .eq("status", "erro");
      if (!cancelled) setCount(c ?? 0);
    };
    load();
    const ch = supabase
      .channel("posts-error-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts_instagram" }, load)
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(ch);
    };
  }, []);

  return count;
}
