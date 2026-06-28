/**
 * ResultCard — the workhorse list item (Search results S4, Saved S7, Home rails S2).
 * Brand-tinted placeholder (never gray-X), open-status, distance, and the
 * positive-only reputation line (♥ count — NEVER stars; "New to Compass" when new).
 * Inline quick actions: Call · Directions · Save.
 *
 * Deps: lucide-react (`npm i lucide-react`). Swap <a> for your router's <Link>.
 * Caller computes isOpen/closesAt/distanceMi (hours + geo live in the data layer).
 */
import { Store, BadgeCheck, Heart, Phone, Navigation } from "lucide-react";
import type { Business } from "../lib/types";

export interface ResultCardProps {
  business: Business;
  distanceMi?: number;
  recommendCount?: number;   // deferred feature; falsy → "New to Compass"
  isOpen?: boolean;          // computed from hours by caller
  closesAt?: string;         // e.g. "6 PM"
  saved?: boolean;
  onSave?: (id: string) => void;
  onOpen?: (slug: string) => void; // navigate to profile
}

function mapsHref(b: Business) {
  const dest = b.geo ? `${b.geo.lat},${b.geo.lng}` : b.address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

export function ResultCard({
  business, distanceMi, recommendCount, isOpen, closesAt, saved, onSave, onOpen,
}: ResultCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      {/* Clickable info region → profile */}
      <button
        type="button"
        onClick={() => onOpen?.(business.slug)}
        className="flex w-full items-start gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      >
        {/* Thumbnail — brand-tinted placeholder when no photo */}
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md">
          {business.photos[0] ? (
            <img src={business.photos[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-positive-tint">
              <Store className="h-5 w-5 text-positive" strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-heading text-[15px] font-semibold text-foreground">
              {business.name}
            </span>
            {business.verified && (
              <>
                <BadgeCheck className="h-4 w-4 shrink-0 text-positive" strokeWidth={1.75} aria-hidden />
                <span className="sr-only">Verified</span>
              </>
            )}
          </span>

          <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
            {business.category}
            {typeof distanceMi === "number" && ` · ${distanceMi.toFixed(1)} mi`}
          </span>

          <span className="mt-1 flex items-center gap-2 text-[12.5px]">
            {isOpen != null && (
              <span className={isOpen ? "font-medium text-positive" : "text-ink-faint"}>
                {isOpen ? (closesAt ? `Open · until ${closesAt}` : "Open") : "Closed"}
              </span>
            )}
            {recommendCount && recommendCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-positive">
                <Heart className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden />
                {recommendCount}
                <span className="sr-only">locals recommend</span>
              </span>
            ) : (
              <span className="text-ink-faint">New to Compass</span>
            )}
          </span>
        </span>
      </button>

      {/* Quick actions — siblings of the clickable region (no nested-button issues) */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        {business.phone && (
          <a
            href={`tel:${business.phone.replace(/[^\d+]/g, "")}`}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Call
          </a>
        )}
        <a
          href={mapsHref(business)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Navigation className="h-4 w-4" strokeWidth={1.75} aria-hidden /> Directions
        </a>
        <button
          type="button"
          onClick={() => onSave?.(business.id)}
          aria-pressed={!!saved}
          aria-label={saved ? "Saved" : "Save"}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Heart className={`h-4 w-4 ${saved ? "fill-current text-positive" : ""}`} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </article>
  );
}
