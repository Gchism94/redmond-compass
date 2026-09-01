import { useParams, Link } from "react-router-dom";
import { MapPin, Clock, Bookmark, Navigation, CalendarDays, ExternalLink } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button, Thumb, StatusBadge, EmptyState, Skeleton, AddToCalendar, ErrorState } from "@/components";
import { useEvent, useBusinessById } from "@/data/queries";
import { eventDateBadge, eventTimeShort } from "@/lib/format";
import { useI18n } from "@/i18n";
import { directionsHref } from "@/lib/links";
import { useSession } from "@/features/account/session";

/** Single event detail. */
export function EventDetailScreen() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: event, isLoading, isFetched, isError, refetch } = useEvent(id);
  const host = useBusinessById(event?.businessId);
  const session = useSession();

  if (isLoading) {
    return (
      <>
        <ScreenHeader title={t("events.event")} back />
        <div className="space-y-3 px-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </>
    );
  }
  // isError BEFORE the not-found branch. React Query sets `isFetched` after a FAILED fetch
  // too, so without this a dropped connection fell through to "not found" — telling the user
  // this listing doesn't exist when in truth we just couldn't reach the server.
  if (isError)
    return (
      <div className="pt-10">
        <ErrorState title={t("error.loadEvents")} onRetry={() => refetch()} />
      </div>
    );
  if (isFetched && !event)
    return (
      <>
        <ScreenHeader title={t("events.event")} back />
        <EmptyState
          icon={<MapPin size={20} />}
          title={t("events.notFound")}
          message={t("events.notFoundMsg")}
          action={{ label: t("events.browse"), href: "/events" }}
        />
      </>
    );
  if (!event) return null;

  const badge = eventDateBadge(event.startAt);
  const address = event.address?.trim();
  const venueName = event.venueName?.trim();
  const description = event.description?.trim();
  const eventLink = safeEventLink(event.linkCta);
  const directions = event.geo || address
    ? directionsHref({ address, geo: event.geo })
    : undefined;

  return (
    <div className="pb-6">
      <ScreenHeader title={t("events.event")} back />
      {event.image ? (
        <Thumb
          src={event.image}
          seed={event.title}
          alt={event.title}
          className="h-44 w-full"
          rounded="rounded-none"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-secondary text-positive" aria-hidden>
          <div className="flex items-center gap-2 rounded-xl border border-positive/15 bg-background/35 px-5 py-3">
            <CalendarDays size={28} strokeWidth={1.6} aria-hidden />
            <span className="font-heading text-sm font-semibold">{t("events.event")}</span>
          </div>
        </div>
      )}

      <div className="px-4 pt-4">
        {event.status === "cancelled" && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-3 text-sm leading-relaxed text-foreground" role="status">
            <p className="font-semibold text-accent">{t("events.cancelled")}</p>
            <p className="mt-1 text-muted-foreground">{t("events.cancelledNotice")}</p>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-secondary px-3 py-2 leading-none text-secondary-foreground">
            <span className="font-heading text-lg font-bold">{badge.day}</span>
            <span className="text-[10px] font-medium uppercase text-muted-foreground">{badge.mo}</span>
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold leading-tight text-foreground">{event.title}</h1>
            {(event.category || event.tags?.length) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {event.category && <StatusBadge tone="accent">{event.category}</StatusBadge>}
                {event.tags?.map((tag) => (
                  <StatusBadge key={tag} tone="neutral">
                    {tag}
                  </StatusBadge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2.5 text-sm">
          <div className="flex gap-2.5">
            <Clock size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
            <span className="text-foreground">{eventTimeShort(event.startAt)}</span>
          </div>
          {(venueName || address) && (
            <div className="flex gap-2.5">
              <MapPin size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
              <span className="text-foreground">
                {venueName}
                {venueName && address ? <span className="text-muted-foreground"> · {address}</span> : address}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {event.status !== "cancelled" && <AddToCalendar event={event} align="left" />}
          {eventLink && (
            <a
              href={eventLink.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-tap items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-positive transition hover:bg-muted"
            >
              {eventLink.label} <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </div>

        {description && (
          <p className="mt-4 text-sm leading-relaxed text-foreground">{description}</p>
        )}

        {host.data && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("events.hostedBy")}{" "}
            <Link to={`/b/${host.data.slug}`} className="font-semibold text-positive hover:underline">
              {host.data.name}
            </Link>
          </p>
        )}

        <div className="mt-5 flex gap-2">
          {directions && (
            <a
              href={directions}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-tap h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
            >
              <Navigation size={16} /> {t("common.directions")}
            </a>
          )}
          <Button
            variant={session.isSavedEvent(event.id) ? "positive" : "ghost"}
            onClick={() => session.toggleSaveEvent(event.id)}
            aria-pressed={session.isSavedEvent(event.id)}
          >
            <Bookmark
              size={16}
              className={session.isSavedEvent(event.id) ? "fill-current" : undefined}
            />{" "}
            {session.isSavedEvent(event.id) ? t("common.saved") : t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function safeEventLink(link?: { label: string; url: string }): { label: string; href: string } | undefined {
  const rawUrl = link?.url.trim();
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return { href: url.href, label: link?.label.trim() || url.hostname.replace(/^www\./, "") };
  } catch {
    return undefined;
  }
}
