import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, type PostInstagram, TIMEZONE } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { formatBR, truncate, nowSP, startOfDaySP, toSP } from "@/lib/format";
import { TipoBadge, StatusBadge } from "@/components/Badges";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, FileEdit, CheckCircle2, TrendingUp, Search, Check, BarChart3, Users, Heart, ArrowRight } from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";
import { format as fmtTz } from "date-fns-tz";
import { toast } from "sonner";
import { callInsights, unixSecondsAgo, type IGProfile, type IGInsightsResponse, type IGMediaResponse } from "@/lib/insights";

export const Route = createFileRoute("/")({ component: Dashboard, ssr: false });


const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function Dashboard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostInstagram[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("posts_instagram")
        .select("id,imagem_url,legenda,data_publicacao,status,tipo_post,erro_msg,publicado_em,created_at")
        .order("data_publicacao", { ascending: true });
      setPosts((data ?? []) as unknown as PostInstagram[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("posts-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts_instagram" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const agendados = posts.filter((p) => p.status === "agendado").length;
  const publicados = posts.filter((p) => p.status === "publicado").length;
  const rascunhos = posts.filter((p) => p.status === "rascunho").length;
  const wkStart = startOfWeek(nowSP(), { weekStartsOn: 1 });
  const wkEnd = endOfWeek(nowSP(), { weekStartsOn: 1 });
  const semana = posts.filter((p) => {
    if (!p.data_publicacao) return false;
    const d = toSP(p.data_publicacao);
    return d >= wkStart && d <= wkEnd;
  }).length;

  const proximosGrouped = useMemo(() => {
    const todayStart = startOfDaySP();
    const filtered = posts
      .filter((p) => (p.status === "agendado" || p.status === "rascunho") && p.data_publicacao && toSP(p.data_publicacao) >= todayStart)
      .slice(0, 20);
    const groups = new Map<string, { label: string; date: Date; posts: PostInstagram[] }>();
    filtered.forEach((p) => {
      const d = toSP(p.data_publicacao!);
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

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CalendarClock />} label="Posts Agendados" value={agendados} accent />
        <StatCard icon={<CheckCircle2 />} label="Publicados" value={publicados} />
        <StatCard icon={<FileEdit />} label="Rascunhos" value={rascunhos} />
        <StatCard icon={<TrendingUp />} label="Esta Semana" value={semana} />
      </div>

      <InsightsSummary />



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
                          {p.imagem_url && <img src={p.imagem_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
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
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Tendências</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Descubra os temas e formatos que estão bombando agora.
            </p>
            <button
              disabled
              title="Em breve"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary/15 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Search className="h-4 w-4" /> Pesquisar Tendências
            </button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">Em breve</p>
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

function InsightsSummary() {
  const { user } = useAuth();
  const profileQ = useQuery({
    queryKey: ["ig", "profile"],
    queryFn: () => callInsights<IGProfile>("profile"),
    staleTime: 5 * 60 * 1000,
    retry: 0,
    enabled: !!user,
  });
  const reachQ = useQuery({
    queryKey: ["ig", "reach-7d-summary"],
    queryFn: async () => {
      const { since, until } = unixSecondsAgo(7);
      return callInsights<IGInsightsResponse>("insights", {
        metric: "reach", period: "day", since, until, metric_type: "total_value",
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: 0,
    enabled: !!user,
  });
  const topQ = useQuery({
    queryKey: ["ig", "media-summary"],
    queryFn: () => callInsights<IGMediaResponse>("media", { limit: 1 }),
    staleTime: 10 * 60 * 1000,
    retry: 0,
    enabled: !!user,
  });

  if (profileQ.error && reachQ.error && topQ.error) return null; // graceful hide if token bad

  const followers = profileQ.data?.followers_count;
  const reach = reachQ.data?.data?.[0]?.total_value?.value
    ?? reachQ.data?.data?.[0]?.values?.reduce((s, v) => s + (v.value || 0), 0)
    ?? null;
  const top = topQ.data?.data?.[0];

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Instagram Insights</h2>
        </div>
        <Link to="/insights" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryItem
          icon={<Users className="h-4 w-4" />}
          label="Seguidores"
          loading={profileQ.isLoading}
          value={followers ? followers.toLocaleString("pt-BR") : "—"}
        />
        <SummaryItem
          icon={<TrendingUp className="h-4 w-4" />}
          label="Alcance (7d)"
          loading={reachQ.isLoading}
          value={reach !== null ? Number(reach).toLocaleString("pt-BR") : "—"}
        />
        <div className="bg-background/50 border border-border/50 rounded-lg p-3 flex items-center gap-3">
          <div className="h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
            {top && <img src={top.thumbnail_url || top.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Heart className="h-3 w-3" /> Último post
            </p>
            {topQ.isLoading ? (
              <Skeleton className="h-4 w-32 mt-1" />
            ) : (
              <p className="text-sm truncate">{top ? truncate(top.caption, 45) : "—"}</p>
            )}
            {top && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {(top.like_count ?? 0).toLocaleString("pt-BR")} curtidas
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: string; loading: boolean }) {
  return (
    <div className="bg-background/50 border border-border/50 rounded-lg p-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-md bg-primary/15 text-primary flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="h-5 w-16 mt-1" /> : <p className="text-lg font-display font-semibold">{value}</p>}
      </div>
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
