import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Share2, Globe, MapPin, Phone as PhoneIcon, Clock } from "lucide-react";
import {
  ActionBar,
  EventCard,
  FeedItem,
  StatusBadge,
  VerifiedBadge,
  OpenStatusLabel,
  Chip,
  Thumb,
  Skeleton,
  EmptyState,
} from "@/components";
import { IconButton } from "@/components/ui/IconButton";
import { useBusiness, useBulletins, useEvents } from "@/data/queries";
import { WEEKDAY_ORDER, DAY_LABEL, todayKey, formatClock } from "@/lib/hours";
import { directionsHref } from "@/lib/links";
import { relativeTime } from "@/lib/format";
import { useSession } from "@/features/account/session";
import type { Business } from "@/lib/types";

/**
 * Business Profile (S5) — the anchor screen. A FREE listing must read COMPLETE:
 * hero, sticky actions, at-a-glance, bulletins, events, about, verified signal.
 * Member-only blocks (story, perks, modules) and the recommend block are deferred
 * and simply not rendered (no empty stubs, nothing visibly "locked").
 */
export function BusinessProfileScreen() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: business, isLoading, isFetched } = useBusiness(slug);
  const bulletins = useBulletins({ businessId: business?.id, limit: 5 });
  const events = useEvents({ businessId: business?.id });
  const session = useSession();

  // Record recently-viewed (local, no auth) once the business resolves.
  const businessId = business?.id;
  const addRecentlyViewed = session.addRecentlyViewed;
  useEffect(() => {
    if (businessId) addRecentlyViewed(businessId);
  }, [businessId, addRecentlyViewed]);

  if (isLoading) return <ProfileSkeleton />;
  if (isFetched && !business)
    return (
      <div className="pt-10">
        <EmptyState
          icon={<MapPin size={20} />}
          title="Business not found"
          message="That listing may have moved. Search the directory to find it."
          action={{ label: "Back to search", href: "/search" }}
        />
      </div>
    );
  if (!business) return null;

  return (
    <div className="pb-6">
      {/* Topbar over hero */}
      <div className="absolute left-0 right-0 z-20 mx-auto flex max-w-content items-center justify-between px-2 pt-2">
        <IconButton label="Back" variant="solid" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </IconButton>
        <IconButton label="Share" variant="solid" onClick={() => {}}>
          <Share2 size={18} />
        </IconButton>
      </div>

      {/* Hero (single photo at MVP; gallery is Member) */}
      <Thumb
        src={business.photos[0]}
        seed={business.name}
        alt={business.name}
        className="h-44 w-full"
        rounded="rounded-none"
      />

      {/* Header */}
      <div className="px-4 pt-3">
        <h1 className="font-heading text-xl font-bold leading-tight text-foreground">
          {business.name}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[business.category, ...(business.subcategories ?? [])].join(" · ")}
        </p>
        <div className="mt-2">
          <OpenStatusLabel hours={business.hours} />
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
        {business.postFrequency === "weekly" && <StatusBadge tone="neutral">Posts weekly</StatusBadge>}
        {business.responseTime && <StatusBadge tone="neutral">{business.responseTime}</StatusBadge>}
        {business.claimed && (
          <StatusBadge tone="info">On Compass since {new Date(business.createdAt).getFullYear()}</StatusBadge>
        )}
      </div>

      {/* At a glance */}
      <Section title="At a glance">
        {business.hours && <HoursBlock business={business} />}
        <Fact icon={<MapPin size={15} />} label="Address">
          <a
            href={directionsHref({ address: business.address, geo: business.geo })}
            target="_blank"
            rel="noreferrer"
            className="text-positive hover:underline"
          >
            {business.address}
          </a>
        </Fact>
        {business.phone && (
          <Fact icon={<PhoneIcon size={15} />} label="Phone">
            <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="text-positive hover:underline">
              {business.phone}
            </a>
          </Fact>
        )}
        {business.website && (
          <Fact icon={<Globe size={15} />} label="Website">
            <a href={business.website} target="_blank" rel="noreferrer" className="text-positive hover:underline">
              {business.website.replace(/^https?:\/\//, "")}
            </a>
          </Fact>
        )}
        {business.amenityTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {business.amenityTags.map((t) => (
              <Chip key={t} as="span">
                {t}
              </Chip>
            ))}
          </div>
        )}
      </Section>

      {/* What's new — bulletins */}
      {(bulletins.data?.length ?? 0) > 0 && (
        <Section title="What's new">
          <div className="-my-1 divide-y divide-border">
            {bulletins.data!.map((bl) => (
              <FeedItem
                key={bl.id}
                type="bulletin"
                title={bl.body}
                sourceLabel={business.name}
                seed={business.name}
                time={relativeTime(bl.createdAt)}
                showTypeTag={false}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Upcoming — events */}
      {(events.data?.length ?? 0) > 0 && (
        <Section title="Upcoming">
          <div className="-my-1 divide-y divide-border">
            {events.data!.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </Section>
      )}

      {/* About */}
      <Section title="About">
        <p className="text-sm leading-relaxed text-foreground">{business.description}</p>
      </Section>

      <p className="px-4 pt-2 text-center text-xs text-muted-foreground">
        Information provided by the business ·{" "}
        <Link to="/resources" className="font-semibold text-positive hover:underline">
          See local resources
        </Link>
      </p>
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
                {DAY_LABEL[d]}
                {isToday ? " · Today" : ""}
              </span>
              <span className="tabular-nums">
                {dh.closed || !dh.open ? "Closed" : `${formatClock(dh.open)} – ${formatClock(dh.close)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
