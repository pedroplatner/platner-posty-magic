// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const INSTAGRAM_ACCOUNT_ID = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");
const ACCESS_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN");
const BASE_URL = "https://graph.facebook.com/v25.0";
const FUNCTION_VERSION = "2026-05-19-01";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED = new Set(["profile", "insights", "media", "media_insights"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!INSTAGRAM_ACCOUNT_ID || !ACCESS_TOKEN) {
      return json(
        { error: { message: "Instagram credentials not configured", code: 0 } },
        500,
      );
    }

    const { endpoint, params } = await req.json();
    if (!ALLOWED.has(endpoint)) {
      return json({ error: { message: "Endpoint não permitido", code: 0 } }, 400);
    }

    let url = "";
    const p = params ?? {};

    switch (endpoint) {
      case "profile":
        url = `${BASE_URL}/${INSTAGRAM_ACCOUNT_ID}?fields=username,name,followers_count,follows_count,media_count,profile_picture_url&access_token=${ACCESS_TOKEN}`;
        break;
      case "insights": {
        const { metric, period, since, until, metric_type } = p;
        const qs = new URLSearchParams({ metric, period });
        if (since) qs.set("since", String(since));
        if (until) qs.set("until", String(until));
        if (metric_type) qs.set("metric_type", String(metric_type));
        qs.set("access_token", ACCESS_TOKEN);
        url = `${BASE_URL}/${INSTAGRAM_ACCOUNT_ID}/insights?${qs.toString()}`;
        break;
      }
      case "media": {
        const limit = p.limit ?? 12;
        const qs = new URLSearchParams({
          fields:
            "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
          limit: String(limit),
          access_token: ACCESS_TOKEN,
        });
        if (p.after) qs.set("after", String(p.after));
        url = `${BASE_URL}/${INSTAGRAM_ACCOUNT_ID}/media?${qs.toString()}`;
        break;
      }
      case "media_insights": {
        const { media_id, media_type } = p;
        // Reels / Videos accept a different metric set
        const metrics =
          media_type === "VIDEO" || media_type === "REELS"
            ? "reach,saved,total_interactions,comments,likes"
            : "impressions,reach,saved,total_interactions";
        url = `${BASE_URL}/${media_id}/insights?metric=${metrics}&access_token=${ACCESS_TOKEN}`;
        break;
      }
    }

    const upstream = await fetch(url);
    const data = await upstream.json();

    if (data.error) {
      const code = data.error.code;
      const status = code === 190 ? 401 : code === 4 || code === 17 ? 429 : 400;
      return json(data, status);
    }
    return json(data, 200);
  } catch (e) {
    return json({ error: { message: (e as Error).message, code: 0 } }, 500);
  }
});

function json(body: unknown, status: number) {
  const payload = typeof body === "object" && body !== null
    ? { ...body, function_version: FUNCTION_VERSION }
    : body;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
