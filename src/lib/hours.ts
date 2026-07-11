/**
 * Open/closed computation for the status line (S4 result card, S5 profile).
 * Drives "Open · closes 6:00 PM" / "Closed · opens Tue 7 AM".
 * Special hours (holidays) override the weekly schedule for a given date.
 */
import type { Hours, Weekday, DayHours } from "./types";
import { tGlobal } from "@/i18n";

const ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
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

/** Format "HH:MM" (24h) → "7:00 AM". Returns "" for empty. */
export function formatClock(hhmm: string): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const m = Number(mStr ?? 0);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h}:00 ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function dayHoursFor(hours: Hours, date: Date): DayHours {
  // Special hours (by ISO date) override the weekly pattern.
  const iso = date.toISOString().slice(0, 10);
  const special = hours.special?.find((s) => s.date === iso);
  if (special) {
    if (special.closed) return { open: "", close: "", closed: true };
    if (special.open && special.close) return { open: special.open, close: special.close };
  }
  return hours.week[ORDER[date.getDay()]];
}

/**
 * Compute open status at `now`. Handles overnight close (close < open),
 * and looks ahead up to 7 days for the next opening when closed.
 */
export function getOpenStatus(hours: Hours | undefined, now: Date = new Date()): OpenStatus {
  if (!hours) return { open: false, state: "unknown", label: tGlobal("status.hoursNotListed") };

  const today = dayHoursFor(hours, now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (today && !today.closed && today.open && today.close) {
    const openMin = minutes(today.open);
    let closeMin = minutes(today.close);
    const overnight = closeMin <= openMin;
    if (overnight) closeMin += 24 * 60;
    const cur = nowMin < openMin && overnight ? nowMin + 24 * 60 : nowMin;
    if (cur >= openMin && cur < closeMin) {
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
