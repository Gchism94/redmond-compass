/**
 * Open/closed computation for the status line (S4 result card, S5 profile).
 * Drives "Open · closes 6:00 PM" / "Closed · opens Tue 7 AM".
 * Special hours (holidays) override the weekly schedule for a given date.
 */
import type { Hours, Weekday, DayHours } from "./types";
import { tGlobal } from "@/i18n";

const ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
/** Localized short weekday label ("Mon" / "Lun"). */
export function dayLabel(d: Weekday): string {
  return tGlobal(`day.${d}`);
}

export interface OpenStatus {
  /** true if open right now */
  open: boolean;
  /** "Open" | "Closed" — the lead word, colored pine-green when open */
  state: "open" | "closed" | "unknown";
  /** e.g. "Open" — short status word */
  label: string;
  /** when open: "closes 6:00 PM"; when closed: "opens Tue 7:00 AM" */
  detail?: string;
}

/**
 * A weekly schedule is only safe to turn into an Open/Closed claim when every day is
 * present and internally valid. Imported listings commonly have free-text hours but no
 * structured schedule; treating a partial/default JSON object as canonical makes a
 * confident status less accurate than the source data.
 *
 * A schedule with all seven days marked closed is also considered unusable. That shape is
 * produced by the blank owner form and does not establish that a business is permanently
 * closed.
 */
export function hasValidWeeklyHours(hours: Hours | undefined): hours is Hours {
  if (!hours || typeof hours !== "object" || !hours.week || typeof hours.week !== "object") {
    return false;
  }

  let hasOpenDay = false;
  for (const day of ORDER) {
    const value = hours.week[day];
    if (!value || typeof value !== "object") return false;
    if (value.closed === true) continue;
    if (!isValidTime(value.open) || !isValidTime(value.close) || value.open === value.close) {
      return false;
    }
    hasOpenDay = true;
  }
  return hasOpenDay;
}

/** A clean legacy-hours fallback, shown only when structured hours cannot be trusted. */
export function hoursTextFallback(hours: Hours | undefined, hoursText?: string): string | undefined {
  if (hasValidWeeklyHours(hours)) return undefined;
  const text = hoursText?.trim();
  return text || undefined;
}

/**
 * Light presentation cleanup for trustworthy-but-unstructured source hours.
 * This never invents days or converts prose into an Open/Closed claim; it only
 * normalizes common spacing, clock, and "open every day" wording.
 */
export function formatHoursTextDisplay(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bopen\s+7\s+days\s+a\s+week\b/i, "Daily")
    .replace(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/gi, (_match, hour: string, minutesText: string | undefined, period: string) => {
      const minutes = minutesText && minutesText !== "00" ? `:${minutesText}` : "";
      return `${Number(hour)}${minutes} ${period.toLowerCase().startsWith("a") ? "AM" : "PM"}`;
    })
    .replace(/\s+(?:to|[-–—])\s+close\b/gi, "–close")
    .replace(/^Daily\s+(?=\d)/i, "Daily · ");
}

/** Format "HH:MM" (24h) → "7:00 AM". Returns "" for empty. */
export function formatClock(hhmm: string): string {
  if (!isValidTime(hhmm)) return "";
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const m = Number(mStr ?? 0);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h}:00 ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayHoursFor(hours: Hours, date: Date): DayHours | undefined {
  // Special hours (by ISO date) override the weekly pattern.
  // Use the reader's local calendar date: toISOString() changes the day around Pacific
  // midnight and can apply tomorrow's holiday override to tonight's listing.
  const iso = localDateKey(date);
  const special = hours.special?.find((s) => s.date === iso);
  if (special) {
    if (special.closed) return { open: "", close: "", closed: true };
    if (
      isValidTime(special.open) &&
      isValidTime(special.close) &&
      special.open !== special.close
    ) {
      return { open: special.open, close: special.close };
    }
    return undefined;
  }
  return hours.week[ORDER[date.getDay()]];
}

/**
 * Compute open status at `now`. Handles overnight close (close < open),
 * and looks ahead up to 7 days for the next opening when closed.
 */
export function getOpenStatus(hours: Hours | undefined, now: Date = new Date()): OpenStatus {
  const unknown = (): OpenStatus => ({
    open: false,
    state: "unknown",
    label: tGlobal("status.hoursNotListed"),
  });
  if (!hasValidWeeklyHours(hours)) return unknown();

  const today = dayHoursFor(hours, now);
  if (!today) return unknown();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // An overnight window belongs to yesterday's opening day. Check it before today's
  // schedule so 1:00 AM correctly reads "Open" for a Friday 8 PM–2 AM service window.
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const previous = dayHoursFor(hours, yesterday);
  if (!previous) return unknown();
  if (!previous.closed && previous.open && previous.close) {
    const previousOpen = minutes(previous.open);
    const previousClose = minutes(previous.close);
    if (previousClose < previousOpen && nowMin < previousClose) {
      return {
        open: true,
        state: "open",
        label: tGlobal("status.open"),
        detail: tGlobal("status.closes", { time: formatClock(previous.close) }),
      };
    }
  }

  if (today && !today.closed && today.open && today.close) {
    const openMin = minutes(today.open);
    const closeMin = minutes(today.close);
    const overnight = closeMin < openMin;
    if (nowMin >= openMin && (overnight || nowMin < closeMin)) {
      return {
        open: true,
        state: "open",
        label: tGlobal("status.open"),
        detail: tGlobal("status.closes", { time: formatClock(today.close) }),
      };
    }
    // Before opening today
    if (nowMin < openMin) {
      return {
        open: false,
        state: "closed",
        label: tGlobal("status.closed"),
        detail: tGlobal("status.opens", { time: formatClock(today.open) }),
      };
    }
  }

  // Closed now — find next opening within the next 7 days.
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dh = dayHoursFor(hours, d);
    if (!dh) return unknown();
    if (dh && !dh.closed && dh.open) {
      const wd = ORDER[d.getDay()];
      return {
        open: false,
        state: "closed",
        label: tGlobal("status.closed"),
        detail: tGlobal("status.opens", { time: `${dayLabel(wd)} ${formatClock(dh.open)}` }),
      };
    }
  }

  return { open: false, state: "closed", label: tGlobal("status.closed") };
}

/** Today's weekday key (for highlighting "Today" in the hours list). */
export function todayKey(now: Date = new Date()): Weekday {
  return ORDER[now.getDay()];
}

export { ORDER as WEEKDAY_ORDER };
