import { Link } from "react-router-dom";
import { Phone, Navigation, Bookmark, Heart, UserPlus } from "lucide-react";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/cn";
import { businessHref, directionsHref, telHref } from "@/lib/links";
import { formatDistance, distanceMiles } from "@/lib/geo";
import type { GeoPoint } from "@/lib/types";
import { OpenStatusLabel } from "./ui/OpenStatusLabel";
import { BusinessThumb } from "./BusinessThumb";
import { VerifiedBadge } from "./ui/StatusBadge";
import { useI18n } from "@/i18n";
import { categoryLabelFor } from "@/lib/taxonomy";
import { hasValidWeeklyHours, hoursTextFallback } from "@/lib/hours";

export interface ResultCardProps {
  business: Business;
  /** row = mobile/Saved list; rail = Home rail; card = desktop directory grid */
  variant?: "row" | "rail" | "card";
  origin?: GeoPoint;
  /** show ♥ recommend count — DEFERRED (fast-follow). Off at MVP. */
  showRecommend?: boolean;
  /** Save — guest-local, no sign-in required; the page supplies the handler. */
  saved?: boolean;
  onSave?: (b: Business) => void;
  /**
   * Follow — also guest-local. Optional and OFF by default: follow only earns a slot where
   * the surface is about businesses you might want updates from. Rendered in the `row`
   * variant, next to Save.
   */
  following?: boolean;
  onFollow?: (b: Business) => void;
  className?: string;
}

/**
 * ResultCard — the directory's workhorse. Same Call · Directions · Save verbs as
 * the profile ActionBar, learned once. Equal ranking, no featured slots, no stars.
 */
export function ResultCard({
  business,
  variant = "row",
  origin,
  showRecommend = false,
  saved = false,
  onSave,
  following = false,
  onFollow,
  className,
}: ResultCardProps) {
  const { t } = useI18n();
  const hasPreciseGeo = business.hasPreciseLocation !== false;
  const dist = origin && hasPreciseGeo ? formatDistance(distanceMiles(origin, business.geo)) : undefined;
  const catLine = [categoryLabelFor(business.category), ...(business.subcategories ?? [])].slice(0, 3).join(" · ");
  const tel = telHref(business.phone);
  // Prefer a real address and fall back only to coordinates known to belong to the
  // listing. Imported Redmond-center placeholders must never become Directions targets.
  const address = business.address.trim();
  const directions = address
    ? directionsHref({ address })
    : hasPreciseGeo
      ? directionsHref({ geo: business.geo })
      : undefined;

  if (variant === "rail") {
    return (
      <article
        data-result-card="rail"
        className={cn(
          "block w-36 shrink-0 focus-visible:outline-none lg:w-52 lg:rounded-xl lg:border lg:border-border lg:bg-card lg:p-2 lg:shadow-card lg:transition-[transform,box-shadow,border-color] lg:duration-200 lg:hover:-translate-y-0.5 lg:hover:border-border-strong lg:hover:shadow-lift",
          className,
        )}
      >
        <div className="relative">
          <Link
            to={businessHref(business)}
            aria-label={business.name}
            className="block rounded-lg focus-visible:outline-none"
          >
            <BusinessThumb
              business={business}
              className="brand-image-frame h-20 w-full lg:h-28"
              imageClassName="lg:p-3"
              rounded="rounded-lg"
              fit="contain"
            />
          </Link>
          {onSave && (
            <button
              type="button"
              aria-pressed={saved}
              aria-label={saved ? t("common.saved") : t("common.save")}
              onClick={() => onSave(business)}
              /* 44px TAP TARGET, 28px visual. A rail thumb is only 80px tall and 144px
                 wide, so a full-size 44px chip would swallow it — but shrinking the BUTTON
                 breaks the ≥44px minimum the smoke suite enforces (it caught this at 32px).
                 So the button carries the touch area transparently and the visible chip is
                 an inner span. */
              className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center"
            >
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border backdrop-blur transition",
                  saved
                    ? "border-positive bg-positive/90 text-primary-foreground"
                    : "border-white/40 bg-background/80 text-foreground",
                )}
              >
                <Bookmark size={14} className={saved ? "fill-current" : undefined} />
              </span>
            </button>
          )}
        </div>
        <Link to={businessHref(business)} className="block rounded-md focus-visible:outline-none">
          {/* Fixed name (2 lines) + single-line status so rail-card height is stable
              (skeleton ⇄ content swap doesn't shift the page — CLS). The distance suffix
              is dropped here so the full "Open · closes 7:00 PM" fits the narrow card. */}
          <div className="mt-1.5 line-clamp-2 min-h-[2.4em] font-heading text-sm font-semibold leading-tight text-foreground">
            {business.name}
          </div>
          <div className="mt-0.5 h-5 overflow-hidden">
            <BusinessHours
              business={business}
              className="flex-nowrap whitespace-nowrap text-xs"
            />
          </div>
        </Link>
      </article>
    );
  }

  if (variant === "card") {
    return (
      <article
        data-result-card="desktop"
        className={cn(
          "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-[transform,box-shadow,border-color] duration-200 lg:hover:-translate-y-0.5 lg:hover:border-border-strong lg:hover:shadow-lift lg:focus-within:border-positive/40 lg:focus-within:shadow-lift",
          className,
        )}
      >
        <div className="relative">
          <Link
            to={businessHref(business)}
            aria-label={business.name}
            className="block focus-visible:outline-none"
          >
            <BusinessThumb
              business={business}
              className="brand-image-frame aspect-[16/9] w-full border-b border-border"
              imageClassName="p-4"
              rounded="rounded-none"
              fit="contain"
            />
          </Link>
          <div className="absolute right-2 top-2 flex gap-1">
            <button
              type="button"
              aria-pressed={saved}
              aria-label={saved ? t("common.saved") : t("common.save")}
              onClick={() => onSave?.(business)}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-sm backdrop-blur transition",
                saved
                  ? "border-positive bg-positive/90 text-primary-foreground"
                  : "border-white/50 bg-card/90 text-foreground hover:bg-card",
              )}
            >
              <Bookmark size={17} className={saved ? "fill-current" : undefined} />
            </button>
            {onFollow && (
              <button
                type="button"
                aria-pressed={following}
                aria-label={following ? t("common.following") : t("common.follow")}
                onClick={() => onFollow(business)}
                className={cn(
                  "inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-sm backdrop-blur transition",
                  following
                    ? "border-positive bg-positive/90 text-primary-foreground"
                    : "border-white/50 bg-card/90 text-foreground hover:bg-card",
                )}
              >
                <UserPlus size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <Link to={businessHref(business)} className="block focus-visible:outline-none">
            <div className="flex items-start gap-2">
              <h3 className="line-clamp-2 min-h-[2.5em] font-heading text-md font-semibold leading-tight text-foreground">
                {business.name}
              </h3>
              {business.verified && <VerifiedBadge className="mt-0.5 shrink-0" />}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{catLine}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <BusinessHours business={business} trailing={dist} className="text-sm" />
              {showRecommend && business.recommendCount != null && (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-positive">
                  <Heart size={13} className="fill-current" />
                  {business.recommendCount}
                </span>
              )}
            </div>
          </Link>

          {(tel || directions) && (
            <div data-card-actions className="mt-auto grid grid-cols-2 gap-2 pt-4">
              {tel && (
                <a
                  href={tel}
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:brightness-95",
                    !directions && "col-span-2",
                  )}
                >
                  <Phone size={15} /> {t("common.call")}
                </a>
              )}
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-muted",
                    !tel && "col-span-2",
                  )}
                >
                  <Navigation size={15} /> {t("common.directions")}
                </a>
              )}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <div data-result-card="mobile" className={cn("flex gap-3 py-3", className)}>
      <Link
        to={businessHref(business)}
        aria-label={business.name}
        className="shrink-0 focus-visible:outline-none"
      >
        <BusinessThumb
          business={business}
          className="brand-image-frame h-[58px] w-[58px] ring-1 ring-border/70"
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
            <BusinessHours business={business} trailing={dist} className="text-sm" />
            {showRecommend && business.recommendCount != null && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-positive">
                <Heart size={13} className="fill-current" />
                {business.recommendCount}
              </span>
            )}
          </div>
        </Link>

        <div className="mt-2 flex items-center gap-2">
          {tel && (
            <a
              href={tel}
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-sm font-medium text-primary-foreground transition hover:brightness-95"
            >
              <Phone size={15} /> {t("common.call")}
            </a>
          )}
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <Navigation size={15} /> {t("common.directions")}
            </a>
          )}
          <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? t("common.saved") : t("common.save")}
            onClick={() => onSave?.(business)}
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition",
              saved
                ? "border-positive bg-positive/10 text-positive"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <Bookmark size={16} className={saved ? "fill-current" : undefined} />
          </button>
          {/* Follow — until now the ONLY way to follow anything was to open a full business
              profile and find the button there. Follow is what makes Home's "From places you
              follow" feed personalise, so its discoverability was the ceiling on that feed
              ever having anything in it. Save and Follow read differently on purpose:
              Save = "I'll come back to this", Follow = "tell me when they post". */}
          {onFollow && (
            <button
              type="button"
              aria-pressed={following}
              aria-label={following ? t("common.following") : t("common.follow")}
              onClick={() => onFollow(business)}
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition",
                following
                  ? "border-positive bg-positive/10 text-positive"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <UserPlus size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Structured hours earn live Open/Closed wording only after strict validation. Imported
 * prose is still useful and often more complete, but it is displayed verbatim rather than
 * parsed into a claim the source data cannot support.
 */
function BusinessHours({
  business,
  trailing,
  className,
}: {
  business: Business;
  trailing?: string;
  className?: string;
}) {
  if (hasValidWeeklyHours(business.hours)) {
    return <OpenStatusLabel hours={business.hours} trailing={trailing} className={className} />;
  }

  const fallback = hoursTextFallback(business.hours, business.hoursText);
  if (!fallback) return <OpenStatusLabel trailing={trailing} className={className} />;

  return (
    <span
      className={cn("inline-flex min-w-0 max-w-full items-center gap-x-1.5 text-muted-foreground", className)}
      title={fallback}
    >
      <span className="truncate">{fallback}</span>
      {trailing && <span className="shrink-0">· {trailing}</span>}
    </span>
  );
}
