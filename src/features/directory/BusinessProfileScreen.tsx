import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ExternalLink, ChevronLeft, Share2, Globe, MapPin, Phone as PhoneIcon, Clock, Heart, Check, Compass } from "lucide-react";
import { ActionBar, Button, EventCard, FeedItem, StatusBadge, VerifiedBadge, OpenStatusLabel, Chip, Thumb, Skeleton, EmptyState, ErrorState } from "@/components";
import { IconButton } from "@/components/ui/IconButton";
import {
  useBusiness,
  useBulletins,
  useEvents,
  useBusinessClasses,
  useRecommendations,
  useHasRecommended,
  useRecommend,
} from "@/data/queries";
import { WEEKDAY_ORDER, dayLabel, todayKey, formatClock, hasValidWeeklyHours, hoursTextFallback } from "@/lib/hours";
import { directionsHref, telHref } from "@/lib/links";
import { formatClassDate, relativeTime } from "@/lib/format";
import { useSession } from "@/features/account/session";
import type { Business } from "@/lib/types";
import { useI18n, tGlobal } from "@/i18n";
import { categoryLabelFor } from "@/lib/taxonomy";

/**
 * Business Profile (S5) — the anchor screen. A FREE listing must read COMPLETE:
 * hero, sticky actions, at-a-glance, bulletins, events, about, verified signal.
 * Member-only blocks (story, perks, modules) and the recommend block are deferred
 * and simply not rendered (no empty stubs, nothing visibly "locked").
 */
export function BusinessProfileScreen() {
  const { t, lang } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: business, isLoading, isFetched, isError, refetch } = useBusiness(slug);
  const bulletins = useBulletins({ businessId: business?.id, limit: 5 });
  const events = useEvents({ businessId: business?.id });
  const classes = useBusinessClasses(business?.id);
  const session = useSession();
  const [shareNotice, setShareNotice] = useState<"copied" | "failed" | null>(null);

  // Record recently-viewed (local, no auth) once the business resolves.
  const businessId = business?.id;
  const addRecentlyViewed = session.addRecentlyViewed;
  useEffect(() => {
    if (businessId) addRecentlyViewed(businessId);
  }, [businessId, addRecentlyViewed]);

  useEffect(() => {
    if (!shareNotice) return;
    const timer = window.setTimeout(() => setShareNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);

  if (isLoading) return <ProfileSkeleton />;
  // isError BEFORE the not-found branch. React Query sets `isFetched` after a FAILED fetch
  // too, so without this a dropped connection fell through to "not found" — telling the user
  // this listing doesn't exist when in truth we just couldn't reach the server.
  if (isError)
    return (
      <div className="pt-10">
        <ErrorState title={t("error.loadProfile")} onRetry={() => refetch()} />
      </div>
    );
  if (isFetched && !business)
    return (
      <div className="pt-10">
        <EmptyState
          icon={<MapPin size={20} />}
          title={t("profile.notFound")}
          message={t("profile.notFoundMsg")}
          action={{ label: t("profile.backToSearch"), href: "/search" }}
        />
      </div>
    );
  if (!business) return null;

  const hasStructuredHours = hasValidWeeklyHours(business.hours);
  const fallbackHours = hoursTextFallback(business.hours, business.hoursText);
  const address = business.address.trim();
  const phone = business.phone?.trim();
  const phoneHref = telHref(phone);
  const website = safeWebsite(business.website);
  const amenityTags = business.amenityTags.map((tag) => tag.trim()).filter(Boolean);
  const description = (business.longDescription || business.description).trim();
  const hasAtAGlance =
    hasStructuredHours || !!fallbackHours || !!address || !!phoneHref || !!website || amenityTags.length > 0;

  const shareBusiness = async () => {
    setShareNotice(null);
    const data = { title: business.name, text: description, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(data.url);
      setShareNotice("copied");
    } catch (err) {
      // Closing the native share sheet is a choice, not a product error.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setShareNotice("failed");
    }
  };

  return (
    <div className="pb-6">
      {/* Topbar over hero */}
      <div className="absolute left-0 right-0 z-20 mx-auto flex max-w-content items-center justify-between px-2 pt-2">
        <IconButton label={t("common.back")} variant="solid" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </IconButton>
        <IconButton label={t("common.share")} variant="solid" onClick={shareBusiness}>
          <Share2 size={18} />
        </IconButton>
      </div>
      {shareNotice && (
        <p
          role={shareNotice === "failed" ? "alert" : "status"}
          className="fixed right-3 top-14 z-50 rounded-pill bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-sticky"
        >
          {t(shareNotice === "copied" ? "common.linkCopied" : "common.shareFailed")}
        </p>
      )}

      {/* Hero (single photo at MVP; gallery is Member) */}
      {business.photos[0] ? (
        <Thumb
          src={business.photos[0]}
          seed={business.name}
          alt={business.name}
          className="brand-image-frame h-44 w-full lg:h-64"
          rounded="rounded-none"
        />
      ) : (
        <BrandedHero />
      )}

      {/* Header */}
      <div className="px-4 pt-3">
        <h1 className="font-heading text-xl font-bold leading-tight text-foreground">
          {business.name}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[categoryLabelFor(business.category), ...(business.subcategories ?? [])].join(" · ")}
        </p>
        <div className="mt-2">
          {hasStructuredHours ? (
            <OpenStatusLabel hours={business.hours} />
          ) : fallbackHours ? (
            <p className="text-sm text-muted-foreground">{fallbackHours}</p>
          ) : (
            <OpenStatusLabel />
          )}
        </div>
      </div>

      {/* Sticky action bar — Save/Follow gated by JIT auth via session */}
      <div className="mt-3">
        <ActionBar
          business={business}
          saved={session.isSaved(business.id)}
          following={session.isFollowing(business.id)}
          onSave={() => session.toggleSaveBusiness(business.id)}
          onFollow={() => session.toggleFollow(business.id)}
        />
      </div>

      {/* Trust signals (factual, no stars) */}
      <div className="flex flex-wrap gap-2 px-4 pt-4">
        {business.verified && <VerifiedBadge />}
        {business.postFrequency === "weekly" && <StatusBadge tone="neutral">{t("status.postsWeekly")}</StatusBadge>}
        {business.responseTime && <StatusBadge tone="neutral">{business.responseTime}</StatusBadge>}
        {business.claimed && (
          <StatusBadge tone="info">{t("status.onCompassSince", { year: new Date(business.createdAt).getFullYear() })}</StatusBadge>
        )}
      </div>

      {/* Recommend — positive-only social proof (no stars; never affects ranking) */}
      <RecommendRow businessId={business.id} />

      {/* At a glance */}
      {hasAtAGlance && (
        <Section title={t("profile.atAGlance")}>
          {hasStructuredHours && <HoursBlock business={business} />}
          {!hasStructuredHours && fallbackHours && (
            <Fact icon={<Clock size={15} />} label={t("profile.hours")}>
              {fallbackHours}
            </Fact>
          )}
          {address && (
            <Fact icon={<MapPin size={15} />} label={t("profile.address")}>
              <a
                href={directionsHref({ address })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-tap items-center text-positive hover:underline"
              >
                {address}
              </a>
            </Fact>
          )}
          {phoneHref && phone && (
            <Fact icon={<PhoneIcon size={15} />} label={t("profile.phone")}>
              <a
                href={phoneHref}
                className="inline-flex min-h-tap items-center text-positive hover:underline"
              >
                {phone}
              </a>
            </Fact>
          )}
          {website && (
            <Fact icon={<Globe size={15} />} label={t("profile.website")}>
              <a
                href={website.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-tap items-center text-positive hover:underline"
              >
                {website.label}
              </a>
            </Fact>
          )}
          {amenityTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {amenityTags.map((tag) => (
                <Chip key={tag} as="span">
                  {tag}
                </Chip>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* What's new — bulletins */}
      {bulletins.isError ? (
        <Section title={t("profile.whatsNew")}>
          <ErrorState compact title={t("error.loadNews")} onRetry={() => bulletins.refetch()} />
        </Section>
      ) : (bulletins.data?.length ?? 0) > 0 && (
        <Section title={t("profile.whatsNew")}>
          <div className="-my-1 divide-y divide-border">
            {bulletins.data!.map((bl) => (
              <FeedItem
                key={bl.id}
                type="bulletin"
                title={bl.body}
                sourceLabel={business.name}
                seed={business.name}
                image={business.photos[0]}
                businessCategory={business.category}
                time={relativeTime(bl.createdAt)}
                showTypeTag={false}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Upcoming — events */}
      {events.isError ? (
        <Section title={t("profile.upcoming")}>
          <ErrorState compact title={t("error.loadEvents")} onRetry={() => events.refetch()} />
        </Section>
      ) : (events.data?.length ?? 0) > 0 && (
        <Section title={t("profile.upcoming")}>
          <div className="-my-1 divide-y divide-border">
            {events.data!.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </Section>
      )}

      {/* Classes & workshops — upcoming only.
          Rendered only when there is something to show, like the two sections above: this
          is a section 1 business in 133 currently has, and an empty "Classes" heading on
          the other 132 would be noise. Deliberately NOT a town-wide browse surface — every
          class in the table belongs to one business, so a cross-business rail would be a
          feature slot for that business in an app whose ranking is equal for everyone.

          Images are skipped: every live row hotlinks the studio's own Wix CDN. */}
      {classes.isError ? (
        <Section title={t("profile.classes")}>
          <ErrorState compact title={t("error.loadClasses")} onRetry={() => classes.refetch()} />
        </Section>
      ) : (classes.data?.length ?? 0) > 0 && (
        <Section title={t("profile.classes")}>
          <ul className="-my-1 divide-y divide-border">
            {classes.data!.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-semibold leading-tight text-foreground">
                      {c.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {/* timeText is null on every live row, so it is appended only when
                          present rather than designed around. */}
                      {formatClassDate(c.date, lang)}
                      {c.timeText ? ` · ${c.timeText}` : ""}
                      {c.location ? ` · ${c.location}` : ""}
                    </p>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                    )}
                  </div>
                  {c.status !== "open" && (
                    <span className="shrink-0 rounded-pill border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {c.status === "sold_out" ? t("profile.classSoldOut") : t("profile.classWaitlist")}
                    </span>
                  )}
                </div>
                {c.link && (
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-tap items-center text-sm font-semibold text-positive"
                  >
                    {t("profile.classDetails")} <ExternalLink size={13} className="ml-1" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* About */}
      {description && (
        <Section title={t("profile.about")}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{description}</p>
        </Section>
      )}

      <p className="px-4 pt-2 text-center text-xs text-muted-foreground">
        {t("profile.providedBy")} ·{" "}
        <Link to="/resources" className="inline-flex min-h-tap items-center font-semibold text-positive hover:underline">
          {t("profile.seeResources")}
        </Link>
      </p>
    </div>
  );
}

/**
 * Recommend (♥) — positive-only reputation (BUILD-BRIEF §1, §3). No stars/rating; the
 * count only shows social proof and NEVER reorders results. One per person, can't be
 * un-recommended or down-voted (insert-only at the DB). JIT-gated like save/follow.
 */
function RecommendRow({ businessId }: { businessId: string }) {
  const { t } = useI18n();
  const session = useSession();
  const recs = useRecommendations(businessId);
  const mine = useHasRecommended(businessId);
  const recommend = useRecommend();

  const count = recs.data?.count ?? 0;
  const recommended = mine.data ?? false;
  const onRecommend = () =>
    session.requireAuth(() => recommend.mutate(businessId), "recommend", {
      type: "recommend",
      id: businessId,
    });

  return (
    <div className="mt-4 flex items-center justify-between gap-3 px-4">
      <p className="flex items-center gap-1.5 text-sm">
        <Heart size={15} className="text-accent" fill={count > 0 ? "currentColor" : "none"} aria-hidden />
        {count > 0 ? (
          <span className="text-foreground">
            {count === 1 ? t("profile.recommendOne") : t("profile.recommendMany", { n: count })}
          </span>
        ) : (
          <span className="text-muted-foreground">{t("profile.beFirst")}</span>
        )}
      </p>
      <Button
        size="sm"
        variant={recommended ? "positive" : "ghost"}
        className="min-h-tap"
        onClick={onRecommend}
        disabled={recommended || recommend.isPending}
      >
        {recommended ? (
          <>
            <Check size={14} /> {t("profile.recommended")}
          </>
        ) : (
          <>
            <Heart size={14} /> {t("profile.recommend")}
          </>
        )}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-4 py-4">
      <h2 className="mb-3 font-heading text-md font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex gap-2.5 text-sm">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}:</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function HoursBlock({ business }: { business: Business }) {
  const today = todayKey();
  const hours = business.hours!;
  return (
    <div className="mb-3 flex gap-2.5 text-sm">
      <Clock size={15} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex-1">
        {WEEKDAY_ORDER.map((d) => {
          const dh = hours.week[d];
          const isToday = d === today;
          return (
            <div
              key={d}
              className={
                "flex justify-between py-0.5 " +
                (isToday ? "font-semibold text-positive" : "text-foreground")
              }
            >
              <span>
                {dayLabel(d)}
                {isToday ? ` · ${tGlobal("day.today")}` : ""}
              </span>
              <span className="tabular-nums">
                {dh.closed || !dh.open ? tGlobal("status.closed") : `${formatClock(dh.open)} – ${formatClock(dh.close)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandedHero() {
  return (
    <div
      className="flex h-44 w-full items-center justify-center bg-secondary text-positive lg:h-64"
      aria-hidden
    >
      <div className="flex flex-col items-center gap-2 rounded-xl border border-positive/15 bg-background/35 px-6 py-4">
        <Compass size={34} strokeWidth={1.6} aria-hidden />
        <span className="font-heading text-sm font-semibold tracking-wide">Redmond Compass</span>
      </div>
    </div>
  );
}

function safeWebsite(value?: string): { href: string; label: string } | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (!url.hostname.includes(".")) return undefined;
    return {
      href: url.href,
      label: `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`,
    };
  } catch {
    return undefined;
  }
}

function ProfileSkeleton() {
  return (
    <div>
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="space-y-3 px-4 pt-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
