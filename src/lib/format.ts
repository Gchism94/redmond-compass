/**
 * Date/time + relative-time formatting for feeds, events, and metadata.
 */

const MS_DAY = 86_400_000;

/** "2 days ago", "5 hours ago", "just now" — for bulletins/news metadata. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = now.getTime() - then;
  if (Number.isNaN(then)) return "";
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** { day: "12", mo: "JUL" } for the event date badge. */
export function eventDateBadge(iso: string): { day: string; mo: string } {
  const d = new Date(iso);
  return {
    day: String(d.getDate()),
    mo: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
  };
}

/** "Fri 7 PM" — short event time used in card metadata. */
export function eventTimeShort(iso: string): string {
  const d = new Date(iso);
  const wd = d.toLocaleDateString(undefined, { weekday: "short" });
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

export const EVENT_GROUP_LABEL: Record<EventGroup, string> = {
  today: "Today",
  weekend: "This weekend",
  later: "Later",
  past: "Past",
};
