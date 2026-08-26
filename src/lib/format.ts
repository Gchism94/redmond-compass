/**
 * Date/time + relative-time formatting for feeds, events, and metadata.
 * Locale-aware: strings via tGlobal, Intl via getLocale (components re-render on
 * language change, so these recompute).
 */
import { tGlobal, getLocale } from "@/i18n";

const MS_DAY = 86_400_000;

/** "2 days ago", "5 hours ago", "just now" — for bulletins/news metadata. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = now.getTime() - then;
  if (Number.isNaN(then)) return "";
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return tGlobal("time.justNow");
  if (mins < 60) return tGlobal("time.minAgo", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours === 1 ? tGlobal("time.hourAgo") : tGlobal("time.hoursAgo", { n: hours });
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? tGlobal("time.dayAgo") : tGlobal("time.daysAgo", { n: days });
  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? tGlobal("time.weekAgo") : tGlobal("time.weeksAgo", { n: weeks });
  return new Date(iso).toLocaleDateString(getLocale(), { month: "short", day: "numeric" });
}

/** { day: "12", mo: "JUL" } for the event date badge. */
export function eventDateBadge(iso: string): { day: string; mo: string } {
  const d = new Date(iso);
  return {
    day: String(d.getDate()),
    mo: d.toLocaleDateString(getLocale(), { month: "short" }).toUpperCase(),
  };
}

/** "Fri 7 PM" — short event time used in card metadata. */
export function eventTimeShort(iso: string): string {
  const d = new Date(iso);
  const wd = d.toLocaleDateString(getLocale(), { weekday: "short" });
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const time = m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  return `${wd} ${time}`;
}

/** Bucket an event into a time group for the Events screen (S6). */
export type EventGroup = "today" | "weekend" | "later" | "past";
export function eventGroup(iso: string, now: Date = new Date()): EventGroup {
  const start = new Date(iso);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round((startDay.getTime() - today.getTime()) / MS_DAY);
  if (dayDiff < 0) return "past";
  if (dayDiff === 0) return "today";
  // This weekend = the upcoming Sat/Sun within the next 7 days.
  const dow = start.getDay(); // 0 Sun .. 6 Sat
  if (dayDiff <= 7 && (dow === 6 || dow === 0)) return "weekend";
  return "later";
}

export function eventGroupLabel(g: EventGroup): string {
  return tGlobal(`group.${g}`);
}

/**
 * Format a plain calendar date ("2026-08-17") for display.
 *
 * Parsed from its PARTS, never `new Date("2026-08-17")`. That form is specified to parse as
 * UTC midnight, so in Redmond (UTC-7/-8) it renders as the PREVIOUS day — a class on the
 * 17th would advertise itself as the 16th. `business_classes.date` is a Postgres `date`
 * with no time zone, so there is no instant to convert; it is a day on a calendar and is
 * treated as one.
 */
export function formatClassDate(ymd: string, lang: "en" | "es" = "en"): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd; // unparseable — show the raw value rather than "Invalid Date"
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Absolute date for a town notice — "Jul 3, 2026".
 *
 * Deliberately NOT `relativeTime`. Notices are read to decide whether guidance still
 * applies, and "6 weeks ago" makes the reader do arithmetic against a year they have to
 * assume. The year is always included for the same reason: it is what separates a notice
 * that is merely old from one that is a year old.
 *
 * `createdAt` is a `timestamptz`, so it IS an instant and parses correctly — unlike a
 * date-only column, which must be parsed from parts (see formatClassDate).
 *
 * Rendered in REDMOND's time zone, not the viewer's. This is a hyperlocal town board: the
 * date that matters is the day the town was told, and it must read the same to someone
 * checking from out of state. Without pinning the zone, the live fire-danger notice
 * (2026-07-03T05:41:30Z = 10:41 PM Pacific on July 2) renders as July 2 in Redmond and
 * July 3 in New York — the same notice, two dates, neither obviously wrong. The app
 * already makes exactly this choice for event times (lib/calendar.ts, mappers.toEventLocal).
 */
const REDMOND_TZ = "America/Los_Angeles";

/** YYYY-MM-DD for the current calendar day in Redmond, independent of viewer time zone. */
export function redmondDateYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REDMOND_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatNoticeDate(iso: string, lang: "en" | "es" = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    timeZone: REDMOND_TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
