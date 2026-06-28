/**
 * AddToCalendar — "Add to calendar" menu for an event.
 * Options: Google Calendar, Outlook (web), and Apple/Download (.ics — works
 * everywhere). Use on event detail (/events/:id), event cards, and saved events.
 *
 * Deps: lucide-react.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Download } from "lucide-react";
import type { EventItem } from "../lib/types";
import { eventToICS, downloadICS, googleCalUrl, outlookCalUrl, slugify } from "../lib/calendar";

export interface AddToCalendarProps {
  event: EventItem;
  className?: string;
  /** "button" (default, amber CTA) or "ghost" (subtle, for cards) */
  variant?: "button" | "ghost";
  /** which way the menu opens — "down" (default) or "up" (for bottom-of-screen contexts) */
  menuPlacement?: "down" | "up";
}

export function AddToCalendar({ event, className = "", variant = "button", menuPlacement = "down" }: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const trigger =
    variant === "button"
      ? "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
      : "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-surface-sunken";

  const itemCls =
    "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${trigger} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        <CalendarPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Add to calendar
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-modal ${
            menuPlacement === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <a role="menuitem" href={googleCalUrl(event)} target="_blank" rel="noopener noreferrer"
             onClick={() => setOpen(false)} className={itemCls}>
            Google Calendar
          </a>
          <a role="menuitem" href={outlookCalUrl(event)} target="_blank" rel="noopener noreferrer"
             onClick={() => setOpen(false)} className={itemCls}>
            Outlook
          </a>
          <button role="menuitem" type="button"
            onClick={() => { downloadICS(slugify(event.title), eventToICS(event)); setOpen(false); }}
            className={`${itemCls} border-t border-border`}>
            <Download className="h-4 w-4 text-ink-secondary" strokeWidth={1.75} aria-hidden />
            Apple / Download (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
