import { format, toZonedTime, fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "./supabase";

/** Current date/time as a Date whose wall-clock values reflect America/Sao_Paulo. */
export function nowSP(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/** Start of "today" in São Paulo, returned as a Date with SP wall-clock values. */
export function startOfDaySP(): Date {
  const d = nowSP();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Convert any Date/ISO into a Date with SP wall-clock values. */
export function toSP(d: Date | string): Date {
  return toZonedTime(typeof d === "string" ? new Date(d) : d, TIMEZONE);
}

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
