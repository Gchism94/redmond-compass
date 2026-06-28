import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/hours";

export interface EventCalendarProps {
  events: EventItem[];
  onSelectEvent: (id: string) => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** "YYYY-MM-DD" day key from a naive event start (local Redmond day). */
const dayKey = (iso: string) => iso.slice(0, 10);
const todayKeyStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Month calendar (alternate Events view). Day cells ≥44px; days with events show a
 * pine dot. Selecting a day lists its events below; tapping one opens it.
 */
export function EventCalendar({ events, onSelectEvent }: EventCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0–11
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, EventItem[]>();
    for (const e of events) {
      const k = dayKey(e.startAt);
      const arr = m.get(k);
      if (arr) arr.push(e);
      else m.set(k, [e]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return m;
  }, [events]);

  // On first data arrival, jump to the earliest event's month + select that day.
  useEffect(() => {
    if (selected || events.length === 0) return;
    const keys = [...byDay.keys()].sort();
    const firstKey = keys.find((k) => k >= todayKeyStr()) ?? keys[0];
    if (firstKey) {
      const [y, mo] = firstKey.split("-").map(Number);
      setYear(y);
      setMonth(mo - 1);
      setSelected(firstKey);
    }
  }, [byDay, events.length, selected]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const today = todayKeyStr();

  const step = (dir: 1 | -1) => {
    const d = new Date(year, month + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const keyFor = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
  const selectedEvents = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="px-4 pt-2">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => step(-1)}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-heading text-md font-semibold text-foreground">{monthLabel}</h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => step(1)}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Weekday header */}
      <div className="mt-1 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-xs font-medium text-muted-foreground">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: cells }).map((_, i) => {
          const day = i - firstWeekday + 1;
          if (day < 1 || day > daysInMonth) return <div key={i} className="min-h-tap" />;
          const key = keyFor(day);
          const hasEvents = byDay.has(key);
          const isSelected = key === selected;
          const isToday = key === today;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(key)}
              aria-pressed={isSelected}
              aria-label={`${monthLabel} ${day}${hasEvents ? `, ${byDay.get(key)!.length} event(s)` : ""}`}
              className={cn(
                "flex min-h-tap flex-col items-center justify-center gap-0.5 rounded-md text-sm transition focus-visible:outline-none",
                isSelected
                  ? "bg-foreground font-semibold text-background"
                  : "text-foreground hover:bg-muted",
                !isSelected && isToday && "ring-1 ring-inset ring-positive",
              )}
            >
              <span>{day}</span>
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  hasEvents ? (isSelected ? "bg-background" : "bg-positive") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Selected day's events */}
      <div className="mt-3 border-t border-border pt-3">
        {selectedEvents.length ? (
          <ul className="divide-y divide-border">
            {selectedEvents.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelectEvent(e.id)}
                  className="flex w-full items-start gap-3 py-2.5 text-left focus-visible:outline-none"
                >
                  <span className="w-16 shrink-0 text-xs font-semibold tabular-nums text-positive">
                    {formatClock(e.startAt.slice(11, 16))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-sm font-semibold leading-tight text-foreground">
                      {e.title}
                    </span>
                    {e.venueName && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={11} className="shrink-0" />
                        <span className="truncate">{e.venueName}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {selected ? "No events this day." : "Select a day to see events."}
          </p>
        )}
      </div>
    </div>
  );
}
