/**
 * Calendar export utilities.
 * Lets a resident add an event to their own calendar via:
 *   - .ics download (Apple Calendar, Google import, Outlook desktop, anything)
 *   - Google Calendar deep link
 *   - Outlook web deep link
 *
 * Timezone correctness: event times in the data may be naive local wall-clock
 * (e.g. "2026-07-12T19:00:00"). We interpret naive times in the venue timezone
 * (America/Los_Angeles) and convert to a true UTC instant via Intl, then emit
 * UTC ("…Z") everywhere — unambiguous for every calendar client. Offset-aware
 * strings (with Z or ±hh:mm) are used as-is.
 */
import type { EventItem } from "./types";

export const APP_TZ = "America/Los_Angeles";
const DEFAULT_DURATION_MIN = 120;

const pad = (n: number) => String(n).padStart(2, "0");
const isZoned = (iso: string) => /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);

/** Offset (ms) such that wallclock(date in tz) === date + offset. */
function offsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

/** ISO → true UTC Date. Naive strings are read as wall-clock in `tz`. */
export function toUtcDate(iso: string, tz = APP_TZ): Date {
  if (isZoned(iso)) return new Date(iso);
  const naiveAsUTC = new Date(iso + "Z");          // parse components as if UTC
  return new Date(naiveAsUTC.getTime() - offsetMs(naiveAsUTC, tz));
}

/** UTC Date → "YYYYMMDDTHHMMSSZ" (iCal / Google form). */
export function fmtUTC(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function range(e: EventItem) {
  const start = toUtcDate(e.startAt);
  const end = e.endAt ? toUtcDate(e.endAt) : new Date(start.getTime() + DEFAULT_DURATION_MIN * 60000);
  return { start, end };
}
function locationOf(e: EventItem) {
  return [e.venueName, e.address].filter(Boolean).join(", ");
}

// RFC 5545 text escaping + 75-octet line folding.
const esc = (s = "") =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string): string {
  if (line.length <= 74) return line;
  let out = "", rest = line;
  while (rest.length > 74) { out += rest.slice(0, 74) + "\r\n "; rest = rest.slice(74); }
  return out + rest;
}

function vevent(e: EventItem): string[] {
  const { start, end } = range(e);
  const loc = locationOf(e);
  return [
    "BEGIN:VEVENT",
    `UID:${e.id}@redmondcompass.app`,
    `DTSTAMP:${fmtUTC(new Date())}`,
    `DTSTART:${fmtUTC(start)}`,
    `DTEND:${fmtUTC(end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    loc ? `LOCATION:${esc(loc)}` : "",
    "END:VEVENT",
  ].filter(Boolean);
}

/** Build a .ics document for one or many events. */
export function eventsToICS(events: EventItem[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Redmond Compass//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap(vevent),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n");
}
export const eventToICS = (e: EventItem) => eventsToICS([e]);

/** Trigger a client-side .ics download. */
export function downloadICS(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "event";
}

/** Google Calendar "create event" deep link. */
export function googleCalUrl(e: EventItem): string {
  const { start, end } = range(e);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmtUTC(start)}/${fmtUTC(end)}`,
  });
  if (e.description) p.set("details", e.description);
  const loc = locationOf(e);
  if (loc) p.set("location", loc);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** Outlook (web) "compose event" deep link. */
export function outlookCalUrl(e: EventItem): string {
  const { start, end } = range(e);
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (e.description) p.set("body", e.description);
  const loc = locationOf(e);
  if (loc) p.set("location", loc);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}
