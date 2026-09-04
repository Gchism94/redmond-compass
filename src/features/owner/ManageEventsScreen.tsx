import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, ExternalLink, LockKeyhole, Pencil, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useCreateEvent, useDeleteEvent, useEvents, useUpdateEvent } from "@/data/queries";
import { redmondDateYmd } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import { useI18n } from "@/i18n";
import { MutationError } from "./MutationError";
import { MainSiteContentHandoff } from "./MainSiteContentHandoff";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { appOnly } from "@/lib/siteMode";

const CATEGORIES = ["Music", "Community", "Family", "Festival", "Outdoors", "Workshop", "Food & Drink", "Other"];

export function ManageEventsScreen() {
  return appOnly ? <MainSiteContentHandoff kind="event" /> : <LocalManageEventsScreen />;
}

function LocalManageEventsScreen() {
  const { t, lang } = useI18n();
  const { ownerBusinessId, data: business, isLoading: businessLoading, isError: businessError, refetch: refetchBusiness } = useOwnerBusiness();
  const events = useEvents({ businessId: ownerBusinessId ?? undefined, includePast: true });
  const update = useUpdateEvent();
  const remove = useDeleteEvent();
  const [actionError, setActionError] = useState<unknown>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (businessError) return <ErrorState title={t("error.loadProfile")} onRetry={() => refetchBusiness()} />;
  if (businessLoading || !business) return <ManagerSkeleton title={t("owner.manageEvents")} />;

  const now = Date.now();
  const items = events.data ?? [];
  const current = items.filter((item) => +new Date(item.endAt ?? item.startAt) >= now);
  const past = items.filter((item) => +new Date(item.endAt ?? item.startAt) < now).reverse();
  const busy = update.isPending || remove.isPending;

  const setStatus = async (item: EventItem, status: EventItem["status"]) => {
    setActionError(null);
    setConfirmDeleteId(null);
    try {
      await update.mutateAsync({ id: item.id, patch: { status } });
    } catch (error) {
      setActionError(error);
    }
  };

  const deleteItem = async (id: string) => {
    setActionError(null);
    try {
      await remove.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch (error) {
      setActionError(error);
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader title={t("owner.manageEvents")} back />
      <div className="space-y-5 px-4 pt-1">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{business.name}</p>
            <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-muted-foreground">{t("owner.eventsHint")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to={`/b/${business.slug}`} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted">
              {t("owner.viewPublicProfile")} <ExternalLink size={14} aria-hidden />
            </Link>
            <Link to="/manage/event/new" className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:brightness-95">
              <Plus size={16} aria-hidden /> {t("owner.addEvent")}
            </Link>
          </div>
        </div>
        <MutationError error={actionError} />
        {events.isError ? (
          <ErrorState title={t("error.loadEvents")} onRetry={() => events.refetch()} />
        ) : events.isLoading ? (
          <div className="space-y-3" aria-label={t("common.loading")}><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div>
        ) : items.length === 0 ? (
          <Card><EmptyState icon={<CalendarDays size={21} />} title={t("owner.noEvents")} message={t("owner.noEventsMsg")} action={{ label: t("owner.addEvent"), href: "/manage/event/new" }} /></Card>
        ) : (
          <>
            <EventGroup title={t("owner.upcomingEvents")} emptyText={t("owner.noUpcomingEvents")} items={current} lang={lang} isPast={false} confirmDeleteId={confirmDeleteId} busy={busy} onCancel={(item) => setStatus(item, "cancelled")} onRestore={(item) => setStatus(item, "upcoming")} onAskDelete={setConfirmDeleteId} onDelete={deleteItem} onKeep={() => setConfirmDeleteId(null)} />
            {past.length > 0 && <EventGroup title={t("owner.pastEvents")} items={past} lang={lang} isPast confirmDeleteId={confirmDeleteId} busy={busy} onCancel={(item) => setStatus(item, "cancelled")} onRestore={(item) => setStatus(item, "upcoming")} onAskDelete={setConfirmDeleteId} onDelete={deleteItem} onKeep={() => setConfirmDeleteId(null)} />}
          </>
        )}
      </div>
    </div>
  );
}

interface EventGroupProps {
  title: string;
  emptyText?: string;
  items: EventItem[];
  lang: "en" | "es";
  isPast: boolean;
  confirmDeleteId: string | null;
  busy: boolean;
  onCancel: (item: EventItem) => void;
  onRestore: (item: EventItem) => void;
  onAskDelete: (id: string) => void;
  onDelete: (id: string) => void;
  onKeep: () => void;
}

function EventGroup({ title, emptyText, items, lang, isPast, confirmDeleteId, busy, onCancel, onRestore, onAskDelete, onDelete, onKeep }: EventGroupProps) {
  const { t } = useI18n();
  return (
    <section aria-labelledby={`event-group-${title.replace(/\W+/g, "-")}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={`event-group-${title.replace(/\W+/g, "-")}`} className="font-heading text-md font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? <Card className="px-4 py-5 text-sm text-muted-foreground">{emptyText}</Card> : (
        <div className="space-y-3">
          {items.map((item) => {
            const synced = !!item.gcalEventId;
            const deleting = confirmDeleteId === item.id;
            const statusLabel = item.status === "cancelled" ? t("owner.eventCancelled") : isPast || item.status === "past" ? t("owner.eventPast") : t("owner.eventUpcoming");
            return (
              <Card key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-base font-semibold text-foreground">{item.title}</h3>
                      <StatusBadge tone={!isPast && item.status === "upcoming" ? "positive" : item.status === "cancelled" ? "accent" : "neutral"}>{statusLabel}</StatusBadge>
                      {item.approvalStatus === "pending" && <StatusBadge tone="info">{t("owner.eventPending")}</StatusBadge>}
                      {synced && <StatusBadge tone="neutral"><LockKeyhole size={11} aria-hidden /> {t("owner.calendarManaged")}</StatusBadge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{formatEventDateTime(item.startAt, item.endAt, lang)}{item.venueName ? ` · ${item.venueName}` : ""}</p>
                    {item.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
                  </div>
                  {!synced && <Link to={`/manage/events/${item.id}/edit`} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"><Pencil size={14} aria-hidden /> {t("common.edit")}</Link>}
                </div>
                {synced ? (
                  <div className="mt-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{t("owner.calendarManagedHint")}</div>
                ) : deleting ? (
                  <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3" role="alert">
                    <p className="text-sm text-foreground">{t("owner.deleteEventConfirm")}</p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2"><Button size="sm" variant="ghost" onClick={onKeep} disabled={busy}>{t("owner.keepEvent")}</Button><Button size="sm" variant="destructive" onClick={() => onDelete(item.id)} disabled={busy}><Trash2 size={14} aria-hidden /> {t("owner.deleteEvent")}</Button></div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {!isPast && item.status === "cancelled" ? <Button size="sm" variant="ghost" onClick={() => onRestore(item)} disabled={busy}><RotateCcw size={14} aria-hidden /> {t("owner.restoreEvent")}</Button> : !isPast ? <Button size="sm" variant="ghost" onClick={() => onCancel(item)} disabled={busy}><XCircle size={14} aria-hidden /> {t("owner.cancelEvent")}</Button> : null}
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => onAskDelete(item.id)} disabled={busy}><Trash2 size={14} aria-hidden /> {t("owner.deleteEvent")}</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function EventEditorScreen() {
  return appOnly ? <MainSiteContentHandoff kind="event" /> : <LocalEventEditorScreen />;
}

function LocalEventEditorScreen() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { ownerBusinessId, data: business, isLoading: businessLoading, isError: businessError, refetch: refetchBusiness } = useOwnerBusiness();
  const events = useEvents({ businessId: ownerBusinessId ?? undefined, includePast: true });
  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (businessError) return <ErrorState title={t("error.loadProfile")} onRetry={() => refetchBusiness()} />;
  if (businessLoading || !business || (id && events.isLoading)) return <ManagerSkeleton title={id ? t("owner.editEvent") : t("owner.submitEvent")} />;
  if (id && events.isError) return <ErrorState title={t("error.loadEvents")} onRetry={() => events.refetch()} />;
  const item = id ? events.data?.find((entry) => entry.id === id) : undefined;
  if (id && (!item || item.gcalEventId)) return <><ScreenHeader title={t("owner.editEvent")} back /><EmptyState icon={<CalendarDays size={21} />} title={item?.gcalEventId ? t("owner.calendarManaged") : t("owner.eventNotFound")} message={item?.gcalEventId ? t("owner.calendarManagedHint") : t("owner.eventNotFoundMsg")} action={{ label: t("owner.manageEvents"), href: "/manage/events" }} /></>;
  return <EventForm key={item?.id ?? "new"} businessId={ownerBusinessId} businessName={business.name} businessAddress={business.address} businessGeo={business.geo} initial={item} />;
}

function EventForm({ businessId, businessName, businessAddress, businessGeo, initial }: { businessId: string; businessName: string; businessAddress: string; businessGeo: EventItem["geo"]; initial?: EventItem }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const initialStart = splitEventDateTime(initial?.startAt);
  const initialEnd = splitEventDateTime(initial?.endAt);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initialStart.date);
  const [start, setStart] = useState(initialStart.time);
  const [end, setEnd] = useState(initialEnd.time);
  const [venue, setVenue] = useState(initial?.venueName ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES[0]);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    setValidationError(null);
    setSubmitError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle || !date || !start) return setValidationError(t("owner.eventRequiredError"));
    if (!initial && date < redmondDateYmd()) return setValidationError(t("owner.eventPastDateError"));
    if (end && end <= start) return setValidationError(t("owner.eventEndError"));
    const values = {
      title: cleanTitle,
      startAt: `${date}T${start}:00`,
      endAt: end ? `${date}T${end}:00` : undefined,
      venueName: venue.trim() || businessName,
      address: address.trim() || businessAddress,
      geo: businessGeo,
      description: description.trim() || undefined,
      category,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
    };
    try {
      if (initial) await update.mutateAsync({ id: initial.id, patch: values });
      else await create.mutateAsync({ businessId, ...values });
      navigate("/manage/events");
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader title={initial ? t("owner.editEvent") : t("owner.submitEvent")} back />
      <div className="space-y-4 px-4 pt-1">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("owner.eventFormHint")}</p>
        {initial?.status === "cancelled" && <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-foreground">{t("owner.cancelledEventEditHint")}</div>}
        <Card className="space-y-4 p-4">
          <Field label={t("owner.eventTitle")} required htmlFor="ev-title"><input id="ev-title" className={fieldInputClass} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Live acoustic night" /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("owner.date")} required htmlFor="ev-date"><input id="ev-date" type="date" className={fieldInputClass} min={initial ? undefined : redmondDateYmd()} value={date} onChange={(event) => setDate(event.target.value)} /></Field>
            <Field label={t("owner.start")} required htmlFor="ev-start"><input id="ev-start" type="time" className={fieldInputClass} value={start} onChange={(event) => setStart(event.target.value)} /></Field>
            <Field label={t("owner.end")} htmlFor="ev-end"><input id="ev-end" type="time" className={fieldInputClass} value={end} onChange={(event) => setEnd(event.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("owner.venue")} htmlFor="ev-venue" hint={t("owner.venueHint")}><input id="ev-venue" className={fieldInputClass} maxLength={160} value={venue} onChange={(event) => setVenue(event.target.value)} placeholder={businessName} /></Field>
            <Field label={t("owner.address")} htmlFor="ev-addr" hint={t("owner.addressHint")}><input id="ev-addr" className={fieldInputClass} maxLength={240} value={address} onChange={(event) => setAddress(event.target.value)} placeholder={businessAddress} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("owner.category")} htmlFor="ev-cat"><select id="ev-cat" className={fieldInputClass} value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></Field>
            <Field label={t("owner.tags")} htmlFor="ev-tags" hint={t("owner.tagsHint")}><input id="ev-tags" className={fieldInputClass} maxLength={180} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Free, Family" /></Field>
          </div>
          <Field label={t("owner.description")} htmlFor="ev-desc"><textarea id="ev-desc" rows={4} className={fieldInputClass} maxLength={1500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("owner.eventDescPlaceholder")} /></Field>
        </Card>
        {validationError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">{validationError}</p>}
        <MutationError error={submitError} onRetry={submit} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="lg" onClick={() => navigate("/manage/events")} disabled={pending}>{t("common.cancel")}</Button>
          <Button variant="primary" size="lg" onClick={submit} disabled={pending || !title.trim() || !date || !start}>{pending ? (initial ? t("owner.saving") : t("owner.submitting")) : initial ? t("owner.saveChanges") : t("owner.submitEventBtn")}</Button>
        </div>
      </div>
    </div>
  );
}

function splitEventDateTime(value?: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date, time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function formatEventDateTime(startAt: string, endAt: string | undefined, lang: "en" | "es"): string {
  const start = new Date(startAt);
  const locale = lang === "es" ? "es-US" : "en-US";
  const date = start.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const startTime = start.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const endTime = endAt ? new Date(endAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : undefined;
  return `${date} · ${startTime}${endTime ? `–${endTime}` : ""}`;
}

function ManagerSkeleton({ title }: { title: string }) {
  return <div className="pb-8"><ScreenHeader title={title} back /><div className="space-y-3 px-4 pt-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div></div>;
}
