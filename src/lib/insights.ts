import { supabase } from "./supabase";

export type InsightsEndpoint = "profile" | "insights" | "media" | "media_insights";

type MetaApiError = { message?: string; code?: number; error_subcode?: number };

export function isInstagramAuthError(error: unknown): boolean {
  return (
    error instanceof Error && /token|expired|invalid|190|META_TOKEN_EXPIRED/i.test(error.message)
  );
}

function normalizeInsightsError(error: MetaApiError | undefined, fallback: string): Error {
  const message = error?.message || fallback || "Erro ao chamar Instagram";
  if (error?.code === 190 || /access token|session has expired|token/i.test(message)) {
    return new Error(
      "META_TOKEN_EXPIRED: O token de acesso do Instagram expirou. Atualize o segredo META_PAGE_ACCESS_TOKEN com um novo token da Meta e recarregue a página.",
    );
  }
  return new Error(message);
}

async function readFunctionError(error: unknown): Promise<MetaApiError | undefined> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    const text = await context
      .clone()
      .text()
      .catch(() => "");
    if (!text) return undefined;
    try {
      const parsed = JSON.parse(text) as { error?: MetaApiError };
      return parsed.error;
    } catch {
      return { message: text };
    }
  }
  return (context as { error?: MetaApiError } | undefined)?.error;
}

export async function callInsights<T = unknown>(
  endpoint: InsightsEndpoint,
  params?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("instagram-insights", {
    body: { endpoint, params: params ?? {} },
  });
  if (error) {
    // supabase wraps non-2xx; try to surface API error message
    const apiError = await readFunctionError(error);
    throw normalizeInsightsError(apiError, error.message || "Erro ao chamar Instagram");
  }
  if (data && typeof data === "object" && "error" in (data as object)) {
    const e = (data as { error: MetaApiError }).error;
    throw normalizeInsightsError(e, "Erro Instagram");
  }
  return data as T;
}

export interface IGProfile {
  id: string;
  username: string;
  name: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  profile_picture_url: string;
}

export interface IGInsightValue {
  value: number;
  end_time?: string;
}
export interface IGInsightMetric {
  name: string;
  period: string;
  values: IGInsightValue[];
  total_value?: {
    value: number;
    breakdowns?: Array<{ results: Array<{ dimension_values: string[]; value: number }> }>;
  };
}
export interface IGInsightsResponse {
  data: IGInsightMetric[];
}

export interface IGMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}
export interface IGMediaResponse {
  data: IGMedia[];
  paging?: { cursors?: { after?: string }; next?: string };
}

export interface IGMediaInsights {
  data: Array<{ name: string; values: Array<{ value: number }> }>;
}

export function unixSecondsAgo(days: number): { since: number; until: number } {
  const now = Math.floor(Date.now() / 1000);
  return { since: now - days * 86400, until: now };
}
