/**
 * EventCalendar — month-grid calendar view for Events (S6), the alternate to the
 * default list view. Days with events show a pine dot; selecting a day lists its
 * events with an Add-to-Calendar control and a tap-through to detail.
 *
 * Deps: lucide-react. Pure date math (no date library).
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EventItem } from "../lib/types";
import { APP_TZ } from "../lib/calendar";
import { AddToCalendar } from "./AddToCalendar";

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isZoned = (iso: string) => /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);

/** Local calendar day (YYYY-MM-DD). Naive strings keep their date part. */
function dayKey(iso: string, tz = APP_TZ): string {
  if (!isZoned(iso)) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function timeLabel(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return "";
  let h = +m[1]; const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export interface EventCalendarProps {
  events: EventItem[];
  onSelectEvent?: (id: string) => void;
}

export function EventCalendar({ events, onSelectEvent }: EventCalendarProps) {
  const byDay = useMemo(() => {
    const m = new Map<string, EventItem[]>();
    for (const e of events) {
      const k = dayKey(e.startAt);
      const list = m.get(k) ?? [];
      list.push(e);
      m.set(k, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return m;
  }, [events]);

  const today = new Date();
  const todayKey = keyOf(today);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string>(todayKey);

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const step = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const selectedEvents = byDay.get(selected) ?? [];

  return (
    <div className="px-4">
      {/* Month header */}
      <div className="flex items-center justify-between py-2">
        <h2 className="font-heading text-lg font-semibold text-foreground">{MONTHS[view.m]} {view.y}</h2>
        <div className="flex gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-ink-faint">
        {WEEKDAYS.map((w, i) => <div key={i} className="py-1">{w}</div>)}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} aria-hidden />;
          const k = keyOf(d);
          const has = byDay.has(k);
          const isToday = k === todayKey;
          const isSel = k === selected;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(k)}
              aria-pressed={isSel}
              aria-label={`${d.getDate()} ${MONTHS[view.m]}${has ? ", has events" : ""}`}
              className={[
                "relative flex h-11 flex-col items-center justify-center rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSel ? "bg-positive text-primary-foreground font-semibold"
                  : isToday ? "border border-positive-line text-foreground"
                  : "text-foreground hover:bg-surface-sunken",
              ].join(" ")}
            >
              {d.getDate()}
              {has && (
                <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSel ? "bg-primary-foreground" : "bg-positive"}`} aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day's events */}
      <div className="mt-4 space-y-2 pb-2">
        {selectedEvents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong bg-surface-raised p-4 text-center text-sm text-ink-faint">
            No events on this day.
          </p>
        ) : (
          selectedEvents.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-card p-3">
              <button type="button" onClick={() => onSelectEvent?.(e.id)}
                className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <p className="font-heading text-[15px] font-semibold text-foreground">{e.title}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {timeLabel(e.startAt)}{e.venueName ? ` · ${e.venueName}` : ""}
                </p>
              </button>
              <div className="mt-2">
                <AddToCalendar event={e} variant="ghost" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
