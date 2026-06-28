import { Link } from "react-router-dom";
import { Bookmark, MapPin } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { eventDateBadge, eventTimeShort } from "@/lib/format";
import { formatDistance, distanceMiles, REDMOND_CENTER } from "@/lib/geo";
import type { GeoPoint } from "@/lib/types";
import { AddToCalendar } from "./AddToCalendar";

export interface EventCardProps {
  event: EventItem;
  origin?: GeoPoint;
  saved?: boolean;
  onSave?: (e: EventItem) => void;
  /** show an Add-to-calendar action (sibling of the nav link, never nested) */
  addToCalendar?: boolean;
  /** open the calendar menu upward for cards near the viewport bottom */
  calendarMenuPlacement?: "down" | "up";
  className?: string;
}

/**
 * Event row — date badge + title + time/venue/distance + save. Shared across
 * Home, Events (S6), and the profile "Upcoming" section. Reuses the heart-free
 * Save (bookmark) verb.
 */
export function EventCard({
  event,
  origin = REDMOND_CENTER,
  saved,
  onSave,
  addToCalendar,
  calendarMenuPlacement = "down",
  className,
}: EventCardProps) {
  const badge = eventDateBadge(event.startAt);
  const dist =
    event.geo != null ? ` · ${formatDistance(distanceMiles(origin, event.geo))}` : "";
  const meta = `${eventTimeShort(event.startAt)}${event.venueName ? ` · ${event.venueName}` : ""}${dist}`;

  return (
    <div className={cn("flex items-center gap-3 py-2.5", className)}>
      <Link
        to={`/events/${event.id}`}
        className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-secondary px-2.5 py-1.5 leading-none text-secondary-foreground focus-visible:outline-none"
        aria-label={`${badge.mo} ${badge.day}`}
      >
        <span className="font-heading text-md font-bold">{badge.day}</span>
        <span className="text-[10px] font-medium uppercase text-muted-foreground">{badge.mo}</span>
      </Link>
      <Link to={`/events/${event.id}`} className="min-w-0 flex-1 focus-visible:outline-none">
        <div className="font-heading text-sm font-semibold leading-tight text-foreground">
          {event.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          {event.venueName && <MapPin size={11} className="shrink-0" />}
          <span className="truncate">{meta}</span>
        </div>
      </Link>
      {(onSave || addToCalendar) && (
        <div className="flex shrink-0 items-center">
          {addToCalendar && (
            <AddToCalendar event={event} iconOnly variant="ghost" menuPlacement={calendarMenuPlacement} />
          )}
          {onSave && (
            <button
              type="button"
              aria-pressed={saved}
              aria-label={saved ? "Saved" : "Save event"}
              onClick={() => onSave(event)}
              className={cn(
                "rounded-full p-2 transition",
                saved ? "text-positive" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Bookmark size={18} className={saved ? "fill-current" : undefined} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
