import { Link } from "react-router-dom";
import { Phone, Navigation, Bookmark, Heart } from "lucide-react";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/cn";
import { businessHref, directionsHref, telHref } from "@/lib/links";
import { formatDistance, distanceMiles, REDMOND_CENTER } from "@/lib/geo";
import type { GeoPoint } from "@/lib/types";
import { OpenStatusLabel } from "./ui/OpenStatusLabel";
import { Thumb } from "./ui/Thumb";
import { VerifiedBadge } from "./ui/StatusBadge";

export interface ResultCardProps {
  business: Business;
  /** row = S4 results / Saved; rail = Home horizontal rails */
  variant?: "row" | "rail";
  origin?: GeoPoint;
  /** show ♥ recommend count — DEFERRED (fast-follow). Off at MVP. */
  showRecommend?: boolean;
  /** Save is auth-gated (JIT login, step 6); page supplies the handler */
  saved?: boolean;
  onSave?: (b: Business) => void;
  className?: string;
}

/**
 * ResultCard — the directory's workhorse. Same Call · Directions · Save verbs as
 * the profile ActionBar, learned once. Equal ranking, no featured slots, no stars.
 */
export function ResultCard({
  business,
  variant = "row",
  origin = REDMOND_CENTER,
  showRecommend = false,
  saved = false,
  onSave,
  className,
}: ResultCardProps) {
  const dist = formatDistance(distanceMiles(origin, business.geo));
  const catLine = [business.category, ...(business.subcategories ?? [])].slice(0, 3).join(" · ");
  const tel = telHref(business.phone);

  if (variant === "rail") {
    return (
      <Link
        to={businessHref(business)}
        className={cn(
          "block w-32 shrink-0 focus-visible:outline-none",
          className,
        )}
      >
        <Thumb
          src={business.photos[0]}
          seed={business.name}
          alt={business.name}
          className="h-20 w-full"
          rounded="rounded-lg"
        />
        <div className="mt-1.5 font-heading text-sm font-semibold leading-tight text-foreground line-clamp-2">
          {business.name}
        </div>
        <div className="mt-0.5 text-xs">
          <OpenStatusLabel hours={business.hours} trailing={dist} className="text-xs" />
        </div>
      </Link>
    );
  }

  return (
    <div className={cn("flex gap-3 py-3", className)}>
      <Link to={businessHref(business)} className="shrink-0 focus-visible:outline-none">
        <Thumb
          src={business.photos[0]}
          seed={business.name}
          alt={business.name}
          className="h-[58px] w-[58px]"
          rounded="rounded-lg"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={businessHref(business)} className="block focus-visible:outline-none">
          <div className="flex items-start gap-2">
            <h3 className="font-heading text-base font-semibold leading-tight text-foreground">
              {business.name}
            </h3>
            {business.verified && (
              <VerifiedBadge className="mt-0.5 shrink-0" />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{catLine}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <OpenStatusLabel hours={business.hours} trailing={dist} className="text-sm" />
            {showRecommend && business.recommendCount != null && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-positive">
                <Heart size={13} className="fill-current" />
                {business.recommendCount}
              </span>
            )}
          </div>
        </Link>

        <div className="mt-2 flex items-center gap-2">
          <a
            href={tel}
            aria-disabled={!tel}
            onClick={(e) => !tel && e.preventDefault()}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:brightness-95",
              !tel && "pointer-events-none opacity-40",
            )}
          >
            <Phone size={15} /> Call
          </a>
          <a
            href={directionsHref({ address: business.address, geo: business.geo })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:brightness-95"
          >
            <Navigation size={15} /> Directions
          </a>
          <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? "Saved" : "Save"}
            onClick={() => onSave?.(business)}
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition",
              saved
                ? "border-positive bg-positive/10 text-positive"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <Bookmark size={16} className={saved ? "fill-current" : undefined} />
          </button>
        </div>
      </div>
    </div>
  );
}
