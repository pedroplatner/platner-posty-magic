import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueries, useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from "recharts";
import {
  Eye, Users, UserCheck, ExternalLink, TrendingUp, TrendingDown,
  Heart, MessageCircle, Bookmark, BarChart3, Trophy, AlertTriangle, Loader2, CalendarIcon,
} from "lucide-react";
import {
  callInsights, isInstagramAuthError, unixSecondsAgo,
  type IGProfile, type IGInsightsResponse, type IGMediaResponse, type IGMediaInsights,
} from "@/lib/insights";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBR, truncate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({ component: InsightsPage, ssr: false });

type RangePreset = 7 | 14 | 30 | 90;

function InsightsPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<RangePreset>(30);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const profileQ = useQuery({
    queryKey: ["ig", "profile"],
    queryFn: () => callInsights<IGProfile>("profile"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!user,
  });

  const { since, until, days } = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      const fromTs = Math.floor(customRange.from.getTime() / 1000);
      const toDate = new Date(customRange.to);
      toDate.setHours(23, 59, 59, 999);
      const toTs = Math.floor(toDate.getTime() / 1000);
      return { since: fromTs, until: toTs, days: Math.max(1, Math.round((toTs - fromTs) / 86400)) };
    }
    const r = unixSecondsAgo(preset);
    return { ...r, days: preset as number };
  }, [preset, customRange]);

  const tokenError = profileQ.error as Error | undefined;
  const hasExpiredToken = isInstagramAuthError(tokenError);

  return (
    <div className="space-y-8 max-w-7xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Instagram Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas em tempo real da sua conta Business via Meta Graph API.
          </p>
        </div>
        <RangeSelector
          preset={preset}
          onPresetChange={(v) => { setPreset(v); setCustomRange(null); }}
          customRange={customRange}
          onCustomChange={setCustomRange}
        />
      </header>

      {tokenError && <ErrorBanner message={tokenError.message} />}

      <ProfileHeader q={profileQ} />
      {!hasExpiredToken && profileQ.data ? (
        <>
          <FollowersChart since={since} until={until} days={days} />
          <ReachCards since={since} until={until} />
          <DailyBreakdown days={days} until={until} />
          <TopPostsAndGrid />
          <BestTimeHeatmap />
        </>
      ) : null}
    </div>
  );
}

/* ---------------- Range selector com calendário ---------------- */
function RangeSelector({
  preset, onPresetChange, customRange, onCustomChange,
}: {
  preset: RangePreset;
  onPresetChange: (v: RangePreset) => void;
  customRange: DateRange | null;
  onCustomChange: (r: DateRange | null) => void;
}) {
  const opts: RangePreset[] = [7, 14, 30, 90];
  const [calRange, setCalRange] = useState<DateRange | undefined>(customRange ?? undefined);
  const [open, setOpen] = useState(false);
  const isCustom = !!(customRange?.from && customRange?.to);

  const customLabel = isCustom && customRange?.from && customRange?.to
    ? `${format(customRange.from, "dd/MM", { locale: ptBR })} – ${format(customRange.to, "dd/MM", { locale: ptBR })}`
    : "Personalizado";

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1 gap-0.5 flex-wrap">
      {opts.map((d) => (
        <button
          key={d}
          onClick={() => { onPresetChange(d); onCustomChange(null); }}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            !isCustom && preset === d
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {d} dias
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1",
              isCustom
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {customLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={calRange}
            onSelect={setCalRange}
            numberOfMonths={2}
            locale={ptBR}
            disabled={{ after: new Date() }}
            className="pointer-events-auto"
          />
          <div className="flex justify-end gap-2 p-3 border-t border-border">
            <button
              onClick={() => { setCalRange(undefined); onCustomChange(null); setOpen(false); }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Limpar
            </button>
            <button
              onClick={() => {
                if (calRange?.from && calRange?.to) {
                  onCustomChange(calRange);
                  setOpen(false);
                }
              }}
              disabled={!calRange?.from || !calRange?.to}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Aplicar
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const isAuth = /token|expired|invalid|190/i.test(message);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-destructive">
          {isAuth ? "Token do Instagram expirado" : "Erro ao carregar Insights"}
        </p>
        <p className="text-muted-foreground text-xs mt-1">
          {isAuth
            ? "Atualize o segredo META_PAGE_ACCESS_TOKEN com um novo token da Meta para voltar a carregar os dados."
            : message}
        </p>
      </div>
    </div>
  );
}

/* ---------------- Section 1: Profile header ---------------- */
function ProfileHeader({ q }: { q: ReturnType<typeof useQuery<IGProfile>> }) {
  if (q.isLoading) {
    return (
      <section className="flex items-center gap-5 bg-card border border-border rounded-xl p-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-24 rounded-lg" />)}
        </div>
      </section>
    );
  }
  if (q.error || !q.data) return null;
  const p = q.data;
  return (
    <section className="flex items-center gap-5 bg-card border border-border rounded-xl p-6 flex-wrap">
      <img
        src={p.profile_picture_url}
        alt={p.username}
        className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/30"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="flex-1 min-w-[150px]">
        <h2 className="font-display text-xl font-semibold">{p.name}</h2>
        <p className="text-sm text-muted-foreground">@{p.username}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Seguidores" value={p.followers_count} />
        <MiniStat label="Seguindo" value={p.follows_count} />
        <MiniStat label="Posts" value={p.media_count} />
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/50 border border-border/50 rounded-lg px-4 py-3 text-center min-w-[90px]">
      <p className="text-xl font-display font-semibold">{value.toLocaleString("pt-BR")}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

/* ---------------- Section 2: Followers growth chart ---------------- */
function FollowersChart({ since, until, days }: { since: number; until: number; days: number }) {
  const q = useQuery({
    queryKey: ["ig", "follower_count", since, until],
    queryFn: () =>
      callInsights<IGInsightsResponse>("insights", {
        metric: "follower_count", period: "day", since, until,
      }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const series = useMemo(() => {
    const values = q.data?.data?.[0]?.values ?? [];
    return values.map((v) => ({
      date: v.end_time ? new Date(v.end_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "",
      novos: v.value,
    }));
  }, [q.data]);

  const total = series.reduce((s, x) => s + (x.novos || 0), 0);

  return (
    <section className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Crescimento de Seguidores</h2>
          <p className="text-xs text-muted-foreground">Novos seguidores por dia — últimos {days} dias</p>
        </div>
        <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-2">
          <p className="text-[10px] uppercase tracking-wider text-primary">Novos no período</p>
          <p className="text-lg font-display font-semibold text-primary">+{total.toLocaleString("pt-BR")}</p>
        </div>
      </div>
      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.error ? (
        <EmptyChart message="Dados disponíveis após 2+ dias de conta Business" />
      ) : series.length === 0 ? (
        <EmptyChart message="Sem dados no período selecionado" />
      ) : (
        <div className="h-64 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="gFollowers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area type="monotone" dataKey="novos" stroke="#F97316" strokeWidth={2} fill="url(#gFollowers)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/* ---------------- Section 3: Reach & engagement cards (com variação %) ---------------- */
function ReachCards({ since, until }: { since: number; until: number }) {
  const duration = until - since;
  const prevSince = since - duration;
  const prevUntil = since;

  const q = useQuery({
    queryKey: ["ig", "reach-metrics", since, until],
    queryFn: async () => {
      const [reach, views, prevReach, prevViews] = await Promise.allSettled([
        callInsights<IGInsightsResponse>("insights", {
          metric: "reach", period: "day", since, until, metric_type: "total_value",
        }),
        callInsights<IGInsightsResponse>("insights", {
          metric: "profile_views,website_clicks,accounts_engaged", period: "day", since, until, metric_type: "total_value",
        }),
        callInsights<IGInsightsResponse>("insights", {
          metric: "reach", period: "day", since: prevSince, until: prevUntil, metric_type: "total_value",
        }),
        callInsights<IGInsightsResponse>("insights", {
          metric: "profile_views,website_clicks,accounts_engaged", period: "day", since: prevSince, until: prevUntil, metric_type: "total_value",
        }),
      ]);
      return {
        reach: reach.status === "fulfilled" ? reach.value : null,
        views: views.status === "fulfilled" ? views.value : null,
        prevReach: prevReach.status === "fulfilled" ? prevReach.value : null,
        prevViews: prevViews.status === "fulfilled" ? prevViews.value : null,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  function getVal(metric: string, isPrev = false): number | null {
    const reachData = isPrev ? q.data?.prevReach : q.data?.reach;
    const viewsData = isPrev ? q.data?.prevViews : q.data?.views;
    const all = [...(reachData?.data ?? []), ...(viewsData?.data ?? [])];
    const m = all.find((x) => x.name === metric);
    if (!m) return null;
    if (m.total_value && typeof m.total_value.value === "number") return m.total_value.value;
    const sum = (m.values ?? []).reduce((s, v) => s + (v.value || 0), 0);
    return sum || null;
  }

  function pct(curr: number | null, prev: number | null): number | null {
    if (curr === null || prev === null || prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const cards = [
    { label: "Alcance", icon: Users, metric: "reach" },
    { label: "Visitas ao Perfil", icon: UserCheck, metric: "profile_views" },
    { label: "Contas Engajadas", icon: Eye, metric: "accounts_engaged" },
    { label: "Cliques no Site", icon: ExternalLink, metric: "website_clicks" },
  ].map((c) => {
    const curr = getVal(c.metric);
    const prev = getVal(c.metric, true);
    return { ...c, value: curr, change: pct(curr, prev) };
  });

  return (
    <section>
      <h2 className="font-display text-lg font-semibold mb-3">Alcance & Engajamento</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <MetricCard key={c.label} loading={q.isLoading} {...c} />
        ))}
      </div>
    </section>
  );
}

function MetricCard({
  label, icon: Icon, value, change, loading,
}: { label: string; icon: typeof Eye; value: number | null; change: number | null; loading: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center mb-3">
        <Icon className="h-4 w-4" />
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16 mb-2" />
      ) : (
        <p className="text-2xl font-display font-semibold">
          {value === null ? "—" : value.toLocaleString("pt-BR")}
        </p>
      )}
      <div className="flex items-center justify-between mt-1 gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {!loading && change !== null && (
          <span className={cn(
            "text-xs font-medium flex items-center gap-0.5 shrink-0",
            change >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {change >= 0
              ? <TrendingUp className="h-3 w-3" />
              : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Section 4 + 6: Media grid & top posts (cursor pagination) ---------------- */
function TopPostsAndGrid() {
  const mediaQ = useInfiniteQuery({
    queryKey: ["ig", "media"],
    queryFn: ({ pageParam }) =>
      callInsights<IGMediaResponse>("media", {
        limit: 12,
        ...(pageParam ? { after: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.paging?.cursors?.after ?? undefined,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const mediaList = mediaQ.data?.pages.flatMap((p) => p.data) ?? [];

  const insightsQs = useQueries({
    queries: mediaList.map((m) => ({
      queryKey: ["ig", "media-insights", m.id],
      queryFn: () => callInsights<IGMediaInsights>("media_insights", { media_id: m.id, media_type: m.media_type }),
      staleTime: 10 * 60 * 1000,
      retry: 0,
    })),
  });

  const enriched = useMemo(() => {
    return mediaList.map((m, i) => {
      const ins = insightsQs[i]?.data?.data ?? [];
      const get = (n: string) => ins.find((x) => x.name === n)?.values?.[0]?.value ?? 0;
      return {
        ...m,
        views: get("views"),
        reach: get("reach"),
        saved: get("saved"),
        interactions: get("total_interactions"),
      };
    });
  }, [mediaList, insightsQs]);

  const top3 = useMemo(() => {
    return [...enriched].sort((a, b) => b.interactions - a.interactions).slice(0, 3);
  }, [enriched]);

  const isLoading = mediaQ.isLoading;

  return (
    <>
      {/* Top posts ranking */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" /> Top Posts
        </h2>
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : top3.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem posts para ranquear.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {top3.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  "bg-card border rounded-xl p-4 flex gap-3",
                  i === 0 ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
                )}
              >
                <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img src={p.thumbnail_url || p.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <span className="absolute -top-1 -left-1 text-2xl">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">{formatBR(p.timestamp, "dd/MM")}</p>
                  <p className="text-xs mt-1 line-clamp-2">{truncate(p.caption, 80)}</p>
                  <p className="text-sm font-semibold text-primary mt-2">
                    {p.interactions.toLocaleString("pt-BR")} interações
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Full media grid */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Performance dos Posts</h2>
          <p className="text-xs text-muted-foreground">{enriched.length} posts</p>
        </div>
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
          </div>
        ) : mediaQ.error ? (
          <ErrorBanner message={(mediaQ.error as Error).message} />
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enriched.map((p) => (
                <article key={p.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img src={p.thumbnail_url || p.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {formatBR(p.timestamp, "dd/MM/yyyy 'às' HH:mm")} · {p.media_type}
                    </p>
                    <p className="text-sm mt-2 line-clamp-2 flex-1">{truncate(p.caption, 110)}</p>
                    <div className="grid grid-cols-4 gap-2 mt-3 text-xs text-muted-foreground">
                      <Stat icon={<Heart className="h-3 w-3" />} value={p.like_count ?? 0} />
                      <Stat icon={<MessageCircle className="h-3 w-3" />} value={p.comments_count ?? 0} />
                      <Stat icon={<Eye className="h-3 w-3" />} value={p.views || p.reach} />
                      <Stat icon={<Bookmark className="h-3 w-3" />} value={p.saved} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {mediaQ.hasNextPage && (
              <div className="text-center mt-6">
                <button
                  onClick={() => mediaQ.fetchNextPage()}
                  disabled={mediaQ.isFetchingNextPage}
                  className="px-5 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {mediaQ.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                  Ver mais posts
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center gap-1">
      {icon}
      <span>{value.toLocaleString("pt-BR")}</span>
    </div>
  );
}

/* ---------------- Section 5: Best time heatmap ---------------- */
const DAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_MAP: Record<string, number> = { MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6 };

function BestTimeHeatmap() {
  const q = useQuery({
    queryKey: ["ig", "online_followers"],
    queryFn: () =>
      callInsights<IGInsightsResponse>("insights", {
        metric: "online_followers", period: "lifetime",
      }),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const { matrix, max, peaks } = useMemo(() => {
    const mat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let max = 0;
    const values = q.data?.data?.[0]?.values ?? [];
    for (const v of values) {
      const anyV = v as unknown as { value: unknown };
      if (typeof anyV.value === "object" && anyV.value !== null) {
        const date = v.end_time ? new Date(v.end_time) : null;
        if (!date) continue;
        const dow = (date.getDay() + 6) % 7;
        Object.entries(anyV.value as Record<string, number>).forEach(([h, n]) => {
          const hour = Number(h);
          if (!Number.isFinite(hour)) return;
          mat[dow][hour] += n;
          if (mat[dow][hour] > max) max = mat[dow][hour];
        });
      }
    }
    const td = q.data?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    for (const r of td) {
      const [dayKey, hourKey] = r.dimension_values;
      const d = DAY_MAP[dayKey];
      const h = Number(hourKey);
      if (d === undefined || !Number.isFinite(h)) continue;
      mat[d][h] += r.value;
      if (mat[d][h] > max) max = mat[d][h];
    }

    const flat: Array<{ d: number; h: number; v: number }> = [];
    mat.forEach((row, d) => row.forEach((v, h) => flat.push({ d, h, v })));
    const peaks = flat.sort((a, b) => b.v - a.v).slice(0, 3);
    return { matrix: mat, max, peaks };
  }, [q.data]);

  return (
    <section className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Melhor horário para postar</h2>
          <p className="text-xs text-muted-foreground">Quando seus seguidores estão online</p>
        </div>
        {max > 0 && (
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>Menos</span>
            <div className="flex">
              {[0.1, 0.3, 0.5, 0.8, 1].map((o) => (
                <div key={o} className="w-4 h-3" style={{ background: `rgba(249,115,22,${o})` }} />
              ))}
            </div>
            <span>Mais</span>
          </div>
        )}
      </div>
      {q.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : q.error || max === 0 ? (
        <EmptyChart message="Dados de horários disponíveis após acumular atividade dos seguidores" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid grid-cols-[40px_repeat(24,minmax(20px,1fr))] gap-px text-[10px]">
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-center text-muted-foreground">{h % 3 === 0 ? h : ""}</div>
                ))}
                {matrix.map((row, d) => (
                  <FragmentRow key={`row-${d}`} d={d} row={row} max={max} />
                ))}
              </div>
            </div>
          </div>
          {peaks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="text-muted-foreground">Picos:</span>
              {peaks.map((p, i) => (
                <span key={i} className="px-2 py-1 rounded-md bg-primary/15 text-primary font-medium">
                  {DAYS_PT[p.d]} {p.h}h
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function FragmentRow({ d, row, max }: { d: number; row: number[]; max: number }) {
  return (
    <>
      <div className="text-muted-foreground self-center pr-2 text-right">{DAYS_PT[d]}</div>
      {row.map((v, h) => {
        const o = max > 0 ? Math.max(0.05, v / max) : 0;
        return (
          <div
            key={`c${d}-${h}`}
            title={`${DAYS_PT[d]} ${h}h — ${v}`}
            className="aspect-square rounded-sm"
            style={{ background: `rgba(249,115,22,${o})` }}
          />
        );
      })}
    </>
  );
}

/* ---------------- Section: Daily breakdown (comparação dia a dia) ---------------- */
type DailyMetricKey = "profile_views" | "website_clicks" | "accounts_engaged" | "reach" | "follower_count";

const DAILY_METRICS: Array<{ key: DailyMetricKey; label: string; short: string }> = [
  { key: "profile_views", label: "Visitas ao Perfil", short: "Perfil" },
  { key: "website_clicks", label: "Cliques no Site", short: "Site" },
  { key: "accounts_engaged", label: "Contas Engajadas", short: "Engajamento" },
  { key: "reach", label: "Alcance", short: "Alcance" },
  { key: "follower_count", label: "Novos Seguidores", short: "Seguidores" },
];

function utcDayBounds(daysAgo: number): { since: number; until: number; dateISO: string } {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const since = Math.floor(d.getTime() / 1000);
  const until = since + 86400 - 1;
  return { since, until, dateISO: d.toISOString().slice(0, 10) };
}

const DAILY_RANGE_OPTS: Array<{ value: number; label: string }> = [
  { value: 3, label: "3 dias" },
  { value: 7, label: "7 dias" },
  { value: 15, label: "15 dias" },
  { value: 30, label: "30 dias" },
];

function utcDayBoundsFromDate(date: Date): { since: number; until: number; dateISO: string } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const since = Math.floor(d.getTime() / 1000);
  return { since, until: since + 86400 - 1, dateISO: d.toISOString().slice(0, 10) };
}

function DailyBreakdown({ days: _days, until }: { days: number; until: number }) {
  const [active, setActive] = useState<DailyMetricKey>("profile_views");
  const [rangeDays, setRangeDays] = useState<number>(3);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [calRange, setCalRange] = useState<DateRange | undefined>(undefined);
  const [calOpen, setCalOpen] = useState(false);
  const todayBound = Math.floor(Date.now() / 1000);
  const isCustom = !!(customRange?.from && customRange?.to);

  const buckets = useMemo(() => {
    const arr: Array<{ since: number; until: number; dateISO: string }> = [];
    if (isCustom && customRange?.from && customRange?.to) {
      const start = new Date(customRange.from);
      const end = new Date(customRange.to);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(0, 0, 0, 0);
      const cursor = new Date(end);
      while (cursor.getTime() >= start.getTime()) {
        arr.push(utcDayBoundsFromDate(cursor));
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (arr.length >= 90) break;
      }
    } else {
      const nDays = Math.min(Math.max(rangeDays, 1), 90);
      for (let i = 0; i < nDays; i++) arr.push(utcDayBounds(i));
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, isCustom, customRange?.from?.getTime(), customRange?.to?.getTime(), until]);

  const nDays = buckets.length;

  const totalValueQs = useQueries({
    queries: buckets.map((b) => ({
      queryKey: ["ig", "daily-tv", b.dateISO],
      queryFn: () =>
        callInsights<IGInsightsResponse>("insights", {
          metric: "reach,profile_views,website_clicks,accounts_engaged",
          period: "day",
          since: b.since,
          until: Math.min(b.until, todayBound),
          metric_type: "total_value",
        }),
      staleTime: 30 * 60 * 1000,
      retry: 0,
    })),
  });

  const followersQ = useQuery({
    queryKey: ["ig", "daily-followers", nDays],
    queryFn: () =>
      callInsights<IGInsightsResponse>("insights", {
        metric: "follower_count",
        period: "day",
        since: buckets[buckets.length - 1].since,
        until: todayBound,
      }),
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const followersByDate = useMemo(() => {
    const map = new Map<string, number>();
    const values = followersQ.data?.data?.[0]?.values ?? [];
    for (const v of values) {
      if (!v.end_time) continue;
      const iso = new Date(v.end_time).toISOString().slice(0, 10);
      map.set(iso, v.value);
    }
    return map;
  }, [followersQ.data]);

  const rows = useMemo(() => {
    return buckets.map((b, i) => {
      const r = totalValueQs[i]?.data;
      const all = r?.data ?? [];
      const get = (m: string) => {
        const found = all.find((x) => x.name === m);
        if (!found) return 0;
        if (found.total_value && typeof found.total_value.value === "number") return found.total_value.value;
        return (found.values ?? []).reduce((s, v) => s + (v.value || 0), 0);
      };
      return {
        dateISO: b.dateISO,
        profile_views: get("profile_views"),
        website_clicks: get("website_clicks"),
        accounts_engaged: get("accounts_engaged"),
        reach: get("reach"),
        follower_count: followersByDate.get(b.dateISO) ?? 0,
        isToday: i === 0,
        loading: !!totalValueQs[i]?.isLoading,
      };
    });
  }, [buckets, totalValueQs, followersByDate]);

  const anyLoading = totalValueQs.some((q) => q.isLoading) || followersQ.isLoading;

  const chartData = useMemo(() => {
    return [...rows].reverse().map((r) => ({
      date: new Date(r.dateISO + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: r[active],
    }));
  }, [rows, active]);

  const today = rows[0];
  const yesterday = rows[1];
  const todayVal = today?.[active] ?? 0;
  const yesterdayVal = yesterday?.[active] ?? 0;
  const diff = (todayVal as number) - (yesterdayVal as number);
  const diffPct = (yesterdayVal as number) > 0 ? Math.round((diff / (yesterdayVal as number)) * 100) : null;

  const activeMeta = DAILY_METRICS.find((m) => m.key === active)!;

  return (
    <section className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Evolução diária</h2>
          <p className="text-xs text-muted-foreground">Compare cada dia com o anterior — últimos {nDays} dias</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 flex-wrap">
            {DAILY_RANGE_OPTS.map((o) => (
              <button
                key={o.value}
                onClick={() => { setRangeDays(o.value); setCustomRange(null); setCalRange(undefined); }}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  !isCustom && rangeDays === o.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1",
                    isCustom
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarIcon className="h-3 w-3" />
                  {isCustom && customRange?.from && customRange?.to
                    ? `${format(customRange.from, "dd/MM", { locale: ptBR })} – ${format(customRange.to, "dd/MM", { locale: ptBR })}`
                    : "Personalizado"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={calRange}
                  onSelect={setCalRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  disabled={{ after: new Date() }}
                  className="pointer-events-auto"
                />
                <div className="flex justify-end gap-2 p-3 border-t border-border">
                  <button
                    onClick={() => { setCalRange(undefined); setCustomRange(null); setCalOpen(false); }}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={() => {
                      if (calRange?.from && calRange?.to) {
                        setCustomRange({ from: calRange.from, to: calRange.to });
                        setCalOpen(false);
                      }
                    }}
                    disabled={!calRange?.from || !calRange?.to}
                    className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Aplicar
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-right">
            <p className="text-[10px] uppercase tracking-wider text-primary leading-tight">Hoje vs Ontem</p>
            <div className="flex items-center gap-2 justify-end">
              <p className="text-base font-display font-semibold text-primary leading-tight">{(todayVal as number).toLocaleString("pt-BR")}</p>
              {diffPct !== null && (
                <span className={cn("text-xs font-medium flex items-center gap-0.5", diff >= 0 ? "text-green-500" : "text-red-500")}>
                  {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(diffPct)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-4 border-b border-border">
        {DAILY_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              active === m.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {m.short}
          </button>
        ))}
      </div>

      <h3 className="text-sm font-medium mb-2">{activeMeta.label}</h3>

      {anyLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : chartData.every((d) => !d.value) ? (
        <EmptyChart message="Sem dados no período" />
      ) : (
        <div className="h-48 -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gDaily" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F97316" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area type="monotone" dataKey="value" stroke="#F97316" strokeWidth={2} fill="url(#gDaily)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left py-2 px-2 font-medium">Data</th>
              <th className="text-right py-2 px-2 font-medium">Valor</th>
              <th className="text-right py-2 px-2 font-medium">Δ vs dia anterior</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const prev = rows[i + 1];
              const curr = r[active] as number;
              const prevV = prev ? (prev[active] as number) : null;
              const d = prevV !== null ? curr - prevV : null;
              const dp = prevV !== null && prevV > 0 ? Math.round(((curr - prevV) / prevV) * 100) : null;
              const dateLabel = new Date(r.dateISO + "T12:00:00Z").toLocaleDateString("pt-BR", {
                weekday: "short", day: "2-digit", month: "2-digit",
              });
              return (
                <tr key={r.dateISO} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-2">
                    <span className="capitalize">{dateLabel}</span>
                    {r.isToday && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">parcial</span>}
                    {i === 1 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">ontem</span>}
                  </td>
                  <td className="text-right py-2 px-2 font-medium tabular-nums">
                    {r.loading ? <Skeleton className="h-4 w-12 ml-auto" /> : curr.toLocaleString("pt-BR")}
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums">
                    {d === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-xs font-medium",
                        d > 0 ? "text-green-500" : d < 0 ? "text-red-500" : "text-muted-foreground",
                      )}>
                        {d > 0 ? <TrendingUp className="h-3 w-3" /> : d < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                        {d > 0 ? "+" : ""}{d.toLocaleString("pt-BR")}
                        {dp !== null && <span className="ml-1 opacity-70">({dp > 0 ? "+" : ""}{dp}%)</span>}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
