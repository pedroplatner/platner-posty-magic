import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, type PostInstagram } from "@/lib/supabase";
import { formatBR, truncate, nowSP, toSP } from "@/lib/format";
import { TipoBadge } from "@/components/Badges";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  format,
  addMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendario")({ component: CalendarioPage, ssr: false });

function CalendarioPage() {
  const [posts, setPosts] = useState<PostInstagram[]>([]);
  const [month, setMonth] = useState(() => nowSP());
  const [selected, setSelected] = useState<Date>(() => nowSP());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("posts_instagram")
        .select("id,imagem_url,legenda,data_publicacao,status,tipo_post,erro_msg")
        .order("data_publicacao");
      setPosts(data ?? []);
    };
    load();
    const ch = supabase
      .channel("posts-cal")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts_instagram" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const arr: Date[] = [];
    let d = start;
    while (d <= end) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [month]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, PostInstagram[]>();
    posts.forEach((p) => {
      if (!p.data_publicacao) return;
      const d = toSP(p.data_publicacao);
      const key = format(d, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return map;
  }, [posts]);

  const selectedKey = format(selected, "yyyy-MM-dd");
  const selectedPosts = postsByDay.get(selectedKey) ?? [];

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 max-w-7xl">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold capitalize">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex gap-1">
            <button onClick={() => setMonth(addMonths(month, -1))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setMonth(nowSP())} className="px-3 text-xs rounded-md hover:bg-secondary">Hoje</button>
            <button onClick={() => setMonth(addMonths(month, 1))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => (
            <div key={d} className="text-[11px] uppercase tracking-wider text-muted-foreground text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const has = postsByDay.has(key);
            const isCur = isSameMonth(d, month);
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, nowSP());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={cn(
                  "h-12 rounded-md border text-sm flex flex-col items-center justify-center relative transition-colors",
                  isSel ? "border-primary bg-primary/10" : "border-border/50 hover:border-border",
                  !isCur && "opacity-40",
                  isToday && !isSel && "border-primary/40"
                )}
              >
                <span className="leading-none">{format(d, "d")}</span>
                {has && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-display font-semibold mb-1">{format(selected, "dd 'de' MMMM", { locale: ptBR })}</h3>
        <p className="text-xs text-muted-foreground mb-5">{selectedPosts.length} post(s)</p>
        {selectedPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum post neste dia</p>
        ) : (
          <div className="space-y-3">
            {selectedPosts.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border/50">
                <div className="h-12 w-12 rounded overflow-hidden bg-muted shrink-0">
                  {p.imagem_url && <img src={p.imagem_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <TipoBadge tipo={p.tipo_post} />
                  <p className="text-xs mt-1 truncate">{truncate(p.legenda, 40)}</p>
                </div>
                <span className="text-sm font-medium text-primary">{formatBR(p.data_publicacao, "HH:mm")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
