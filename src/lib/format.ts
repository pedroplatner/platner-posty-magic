import { format, toZonedTime, fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "./supabase";

export function formatBR(iso: string | null | undefined, pattern = "dd/MM/yyyy HH:mm") {
  if (!iso) return "—";
  const d = toZonedTime(new Date(iso), TIMEZONE);
  return format(d, pattern, { timeZone: TIMEZONE });
}

export function buildSPDate(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  const local = new Date(`${dateStr}T${timeStr}:00`);
  const utc = fromZonedTime(local, TIMEZONE);
  return utc.toISOString();
}

export function truncate(text: string | null | undefined, n = 80) {
  if (!text) return "";
  return text.length > n ? text.slice(0, n).trim() + "…" : text;
}
