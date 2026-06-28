/**
 * Calendar export for events (step 6b).
 *
 * Event times in the data are NAIVE wall-clock for Redmond, OR (America/Los_Angeles).
 * On export they're converted to TRUE UTC, so `.ics` / Google / Outlook all land on
 * the right wall-clock regardless of the user's device timezone — and DST is handled
 * (PDT in summer, PST in winter) via a timezone-aware offset lookup.
 *
 * Bulk export is `.ics` only; Google/Outlook deep links are single-event.
 */
import type { EventItem } from "./types";

const EVENT_TZ = "America/Los_Angeles"; // Redmond, OR is Pacific
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** Offset (ms) where local = utc + offset, for `instant` interpreted in EVENT_TZ. */
function tzOffsetMs(instant: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const m: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(instant))) {
    if (part.type !== "literal") m[part.type] = Number(part.value);
  }
  let hour = m.hour;
  if (hour === 24) hour = 0; // some engines report midnight as 24
  const asUTC = Date.UTC(m.year, m.month - 1, m.day, hour, m.minute, m.second);
  return asUTC - instant;
}

/** Interpret a naive "YYYY-MM-DDTHH:MM:SS" as EVENT_TZ wall-clock → true UTC Date. */
export function eventStartToUtc(naive: string): Date {
  const [datePart, timePart = "00:00:00"] = naive.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi, s] = timePart.split(":").map(Number);
  const t0 = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
  // Two-pass to settle the offset across DST boundaries.
  let utc = t0 - tzOffsetMs(t0);
  utc = t0 - tzOffsetMs(utc);
  return new Date(utc);
}

function endUtc(e: EventItem, start: Date): Date {
  return e.endAt ? eventStartToUtc(e.endAt) : new Date(start.getTime() + DEFAULT_DURATION_MS);
}

/** UTC compact stamp: YYYYMMDDTHHMMSSZ */
function icsStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding (75 octets). Keeps strict clients happy. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length) {
    out.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return out.join("\r\n");
}

function locationOf(e: EventItem): string {
  return [e.venueName, e.address].filter(Boolean).join(", ");
}

function vevent(e: EventItem, stamp: string): string[] {
  const start = eventStartToUtc(e.startAt);
  const end = endUtc(e, start);
  const loc = locationOf(e);
  return [
    "BEGIN:VEVENT",
    `UID:${e.id}@redmondcompass.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(e.title)}`,
    loc ? `LOCATION:${esc(loc)}` : "",
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    "END:VEVENT",
  ].filter(Boolean);
}

function wrap(lines: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Redmond Compass//Events//EN",
    "CALSCALE:GREGORIAN",
    ...lines,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}

/** Single-event `.ics` document. */
export function eventToICS(e: EventItem): string {
  return wrap(vevent(e, icsStamp(new Date())));
}

/** Multi-event `.ics` document (one calendar, many VEVENTs). */
export function eventsToICS(events: EventItem[]): string {
  const stamp = icsStamp(new Date());
  return wrap(events.flatMap((e) => vevent(e, stamp)));
}

/** Trigger a download of an `.ics` string. */
export function downloadICS(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Google Calendar single-event template link. */
export function googleCalendarUrl(e: EventItem): string {
  const start = eventStartToUtc(e.startAt);
  const end = endUtc(e, start);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsStamp(start)}/${icsStamp(end)}`,
  });
  if (e.description) params.set("details", e.description);
  const loc = locationOf(e);
  if (loc) params.set("location", loc);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook (Office 365) single-event compose link. */
export function outlookCalendarUrl(e: EventItem): string {
  const start = eventStartToUtc(e.startAt);
  const end = endUtc(e, start);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (e.description) params.set("body", e.description);
  const loc = locationOf(e);
  if (loc) params.set("location", loc);
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/** Filename-safe slug for downloads. */
export function slugifyForFile(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "event"
  );
}
