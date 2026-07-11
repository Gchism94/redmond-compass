import { useParams, Link } from "react-router-dom";
import { MapPin, Clock, Bookmark, Navigation } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button, Thumb, StatusBadge, EmptyState, Skeleton, AddToCalendar } from "@/components";
import { useEvent, useBusinessById } from "@/data/queries";
import { eventDateBadge, eventTimeShort } from "@/lib/format";
import { useI18n } from "@/i18n";
import { directionsHref } from "@/lib/links";
import { useSession } from "@/features/account/session";

/** Single event detail. */
export function EventDetailScreen() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: event, isLoading, isFetched } = useEvent(id);
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

  return (
    <div className="pb-6">
      <ScreenHeader title={t("events.event")} back />
      <Thumb src={event.image} seed={event.title} alt={event.title} className="h-44 w-full" rounded="rounded-none" />

      <div className="px-4 pt-4">
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
          {event.venueName && (
            <div className="flex gap-2.5">
              <MapPin size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
              <span className="text-foreground">
                {event.venueName}
                {event.address ? <span className="text-muted-foreground"> · {event.address}</span> : null}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4">
          <AddToCalendar event={event} align="left" />
        </div>

        {event.description && (
          <p className="mt-4 text-sm leading-relaxed text-foreground">{event.description}</p>
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
          <a
            href={directionsHref({ address: event.address, geo: event.geo })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-tap h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
          >
            <Navigation size={16} /> {t("common.directions")}
          </a>
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
