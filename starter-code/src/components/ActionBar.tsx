/**
 * ActionBar — sticky action row on the Business Profile (S5).
 * Call · Directions · Save · Follow. Call is the primary (amber) CTA.
 * `extraActions` is where Pro/loyalty actions (Book, Get quote, Rewards) slot in
 * when offered — gate those with can(tier, "bookings" | "loyalty") at the call site.
 *
 * Deps: lucide-react. Safe-area aware so it clears the home indicator.
 */
import type { ReactNode } from "react";
import { Phone, Navigation, Heart, Bell } from "lucide-react";
import type { Business } from "../lib/types";

export interface ActionBarProps {
  business: Business;
  saved?: boolean;
  following?: boolean;
  onSave?: (id: string) => void;
  onFollow?: (id: string) => void;
  extraActions?: ReactNode;
}

function mapsHref(b: Business) {
  const dest = b.geo ? `${b.geo.lat},${b.geo.lng}` : b.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function ActionBar({
  business, saved, following, onSave, onFollow, extraActions,
}: ActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={`Actions for ${business.name}`}
      className="sticky bottom-0 z-40 flex items-center gap-2 border-t border-border bg-card/95 px-3 py-2.5 backdrop-blur"
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
    >
      {business.phone && (
        <a
          href={`tel:${business.phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Call
        </a>
      )}
      <a
        href={mapsHref(business)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Navigation className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Directions
      </a>

      <button
        type="button"
        onClick={() => onSave?.(business.id)}
        aria-pressed={!!saved}
        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          saved
            ? "border-positive-line bg-positive-tint text-positive"
            : "border-border bg-card text-foreground hover:bg-surface-sunken"
        }`}
      >
        <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} strokeWidth={1.75} aria-hidden />
        <span className="sr-only sm:not-sr-only">{saved ? "Saved" : "Save"}</span>
      </button>

      <button
        type="button"
        onClick={() => onFollow?.(business.id)}
        aria-pressed={!!following}
        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          following
            ? "border-positive-line bg-positive-tint text-positive"
            : "border-border bg-card text-foreground hover:bg-surface-sunken"
        }`}
      >
        <Bell className={`h-4 w-4 ${following ? "fill-current" : ""}`} strokeWidth={1.75} aria-hidden />
        <span className="sr-only sm:not-sr-only">{following ? "Following" : "Follow"}</span>
      </button>

      {extraActions}
    </div>
  );
}
