import { useEffect, useId, useRef, useState } from "react";
import { CalendarPlus, Download, CalendarDays, ExternalLink } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n";
import {
  eventToICS,
  downloadICS,
  googleCalendarUrl,
  outlookCalendarUrl,
  slugifyForFile,
} from "@/lib/calendar";

export interface AddToCalendarProps {
  event: EventItem;
  /** primary = amber (detail/hero); ghost = subtle (cards) */
  variant?: "primary" | "ghost";
  /** open menu upward for cards near the bottom of the viewport */
  menuPlacement?: "down" | "up";
  /** horizontal anchor: "right" for right-aligned triggers (card icons),
   *  "left" for left-aligned triggers (the detail button) */
  align?: "left" | "right";
  /** icon-only trigger (compact card actions) */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Add-to-calendar control. Opens a menu: .ics download (Apple/any), Google, Outlook.
 * Times export as true UTC (see lib/calendar) so the wall-clock is correct everywhere.
 * Esc + click-outside close; menu items are real menuitems for a11y.
 */
export function AddToCalendar({
  event,
  variant = "primary",
  menuPlacement = "down",
  align = "right",
  iconOnly = false,
  className,
}: AddToCalendarProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    {
      key: "ics",
      label: t("events.icsFile"),
      icon: <Download size={16} />,
      run: () => downloadICS(slugifyForFile(event.title), eventToICS(event)),
    },
    {
      key: "google",
      label: "Google Calendar",
      icon: <CalendarDays size={16} />,
      run: () => window.open(googleCalendarUrl(event), "_blank", "noopener,noreferrer"),
    },
    {
      key: "outlook",
      label: "Outlook",
      icon: <ExternalLink size={16} />,
      run: () => window.open(outlookCalendarUrl(event), "_blank", "noopener,noreferrer"),
    },
  ];

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={iconOnly ? t("events.addToCalendar") : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium transition focus-visible:outline-none",
          iconOnly
            ? "min-h-tap min-w-tap rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            : "min-h-tap rounded-lg px-3.5 text-sm",
          !iconOnly && variant === "primary" && "bg-primary text-primary-foreground hover:brightness-95",
          !iconOnly && variant === "ghost" && "border border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <CalendarPlus size={iconOnly ? 18 : 16} />
        {!iconOnly && t("events.addToCalendar")}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t("events.addToCalendar")}
          className={cn(
            "absolute z-40 w-52 overflow-hidden rounded-lg border border-border bg-popover shadow-modal animate-fade-in",
            align === "right" ? "right-0" : "left-0",
            menuPlacement === "up" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={() => {
                it.run();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-3 text-left text-sm text-popover-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="text-muted-foreground">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
