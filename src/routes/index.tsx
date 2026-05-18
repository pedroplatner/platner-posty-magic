import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, type PostInstagram, TIMEZONE } from "@/lib/supabase";
import { formatBR, truncate } from "@/lib/format";
import { TipoBadge, StatusBadge } from "@/components/Badges";
import { CalendarClock, FileEdit, CheckCircle2, TrendingUp, Sparkles, Check } from "lucide-react";
import { startOfWeek, endOfWeek, startOfDay } from "date-fns";
import { toZonedTime, format as fmtTz } from "date-fns-tz";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: Dashboard });

const TEMAS = [
  "Dica rápida do dia",
  "Bastidores do projeto",
  "Antes e depois",
  "Tutorial em 3 passos",
  "Pergunta para o público",
  "Mostre seu produto",
  "Citação inspiradora",
  "Tendência da semana",
];

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function Dashboard() {
  const [posts, setPosts] = useState<PostInstagram[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("posts_instagram")
        .select("*")
        .order("data_publicacao", { ascending: true });
      setPosts(data ?? []);
    };
    load();
    const ch = supabase
      .channel("posts-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts_instagram" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const agendados = posts.filter((p) => p.status === "agendado").length;
  const publicados = posts.filter((p) => p.status === "publicado").length;
  const rascunhos = posts.filter((p) => p.status === "rascunho").length;
  const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const wkEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const semana = posts.filter((p) => {
    if (!p.data_publicacao) return false;
    const d = new Date(p.data_publicacao);
    return d >= wkStart && d <= wkEnd;
  }).length;

  const proximosGrouped = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const filtered = posts
      .filter((p) => (p.status === "agendado" || p.status === "rascunho") && p.data_publicacao && new Date(p.data_publicacao) >= todayStart)
      .slice(0, 20);
    const groups = new Map<string, { label: string; date: Date; posts: PostInstagram[] }>();
    filtered.forEach((p) => {
      const d = toZonedTime(new Date(p.data_publicacao!), TIMEZONE);
      const key = fmtTz(d, "yyyy-MM-dd", { timeZone: TIMEZONE });
      if (!groups.has(key)) {
        groups.set(key, { label: DIAS_SEMANA[d.getDay()], date: d, posts: [] });
      }
      groups.get(key)!.posts.push(p);
    });
    return Array.from(groups.entries()).map(([key, v]) => ({ key, ...v }));
  }, [posts]);

  const ultimosPublicados = useMemo(() => {
    return posts
      .filter((p) => p.status === "publicado")
      .sort((a, b) => {
        const da = new Date(a.publicado_em || a.data_publicacao || a.created_at).getTime();
        const db = new Date(b.publicado_em || b.data_publicacao || b.created_at).getTime();
        return db - da;
      })
      .slice(0, 3);
  }, [posts]);

  async function approve(p: PostInstagram) {
    const { error } = await supabase.from("posts_instagram").update({ status: "agendado" }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Rascunho aprovado e agendado");
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CalendarClock />} label="Posts Agendados" value={agendados} accent />
        <StatCard icon={<CheckCircle2 />} label="Publicados" value={publicados} />
        <StatCard icon={<FileEdit />} label="Rascunhos" value={rascunhos} />
        <StatCard icon={<TrendingUp />} label="Esta Semana" value={semana} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-lg font-semibold">Próximos Posts</h2>
              <p className="text-xs text-muted-foreground">Agrupados por dia</p>
            </div>
            <Link to="/fila" className="text-xs text-primary hover:underline">Ver fila →</Link>
          </div>
          {proximosGrouped.length === 0 ? (
            <Empty message="Nenhum post agendado" cta="Criar primeiro post" onClick={() => navigate({ to: "/novo-post" })} />
          ) : (
            <div className="space-y-5">
              {proximosGrouped.map((g) => (
                <div key={g.key}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{g.label}</h3>
                    <span className="text-xs text-muted-foreground">{fmtTz(g.date, "dd/MM", { timeZone: TIMEZONE })}</span>
                  </div>
                  <div className="space-y-2">
                    {g.posts.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors">
                        <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                          {p.imagem_url && <img src={p.imagem_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <TipoBadge tipo={p.tipo_post} />
                            <StatusBadge status={p.status} errorMsg={p.erro_msg} />
                          </div>
                          <p className="text-sm truncate">{truncate(p.legenda, 60)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-primary">{formatBR(p.data_publicacao, "HH:mm")}</p>
                        </div>
                        {p.status === "rascunho" && (
                          <button
                            onClick={() => approve(p)}
                            title="Aprovar e agendar"
                            className="h-8 w-8 rounded-md bg-success/15 text-success hover:bg-success/25 flex items-center justify-center shrink-0"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Temas Sugeridos</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {TEMAS.map((t) => (
                <button
                  key={t}
                  onClick={() => navigate({ to: "/novo-post", search: { tema: t, id: "" } as any })}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-primary hover:text-primary-foreground border border-border transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <h2 className="font-display text-lg font-semibold">Últimos Publicados</h2>
            </div>
            {ultimosPublicados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum post publicado ainda</p>
            ) : (
              <div className="space-y-3">
                {ultimosPublicados.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {p.imagem_url && <img src={p.imagem_url} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {formatBR(p.publicado_em || p.data_publicacao, "dd/MM 'às' HH:mm")}
                      </p>
                      <p className="text-sm truncate">{truncate(p.legenda, 50)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className={`bg-card border ${accent ? "border-primary/40" : "border-border"} rounded-xl p-5`}>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${accent ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
        <div className="[&>svg]:h-4 [&>svg]:w-4">{icon}</div>
      </div>
      <p className="text-2xl font-display font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function Empty({ message, cta, onClick }: { message: string; cta: string; onClick: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <button onClick={onClick} className="text-sm text-primary hover:underline font-medium">{cta} →</button>
    </div>
  );
}
