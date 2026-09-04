import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  useCreateBusinessClass,
  useDeleteBusinessClass,
  useManagedBusinessClasses,
  useUpdateBusinessClass,
} from "@/data/queries";
import { formatClassDate, redmondDateYmd } from "@/lib/format";
import type { BusinessClass } from "@/lib/types";
import { useI18n } from "@/i18n";
import { MutationError } from "./MutationError";
import { MainSiteContentHandoff } from "./MainSiteContentHandoff";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { appOnly } from "@/lib/siteMode";

type ActiveClassStatus = Exclude<BusinessClass["status"], "cancelled">;

/** Complete owner view of class/workshop history, including reversible cancellations. */
export function ManageClassesScreen() {
  return appOnly ? <MainSiteContentHandoff kind="class" /> : <LocalManageClassesScreen />;
}

function LocalManageClassesScreen() {
  const { t, lang } = useI18n();
  const { ownerBusinessId, data: business, isLoading: businessLoading, isError: businessError, refetch: refetchBusiness } = useOwnerBusiness();
  const classes = useManagedBusinessClasses(ownerBusinessId ?? undefined);
  const update = useUpdateBusinessClass();
  const remove = useDeleteBusinessClass();
  const [actionError, setActionError] = useState<unknown>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (businessError)
    return <ErrorState title={t("error.loadProfile")} onRetry={() => refetchBusiness()} />;
  if (businessLoading || !business) return <ClassManagerSkeleton title={t("owner.manageClasses")} />;

  const today = redmondDateYmd();
  const items = classes.data ?? [];
  const current = items.filter((item) => item.date >= today);
  const past = items.filter((item) => item.date < today).reverse();

  const setStatus = async (item: BusinessClass, status: BusinessClass["status"]) => {
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
      <ScreenHeader title={t("owner.manageClasses")} back />
      <div className="space-y-5 px-4 pt-1">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{business.name}</p>
            <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-muted-foreground">
              {t("owner.classesHint")}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to={`/b/${business.slug}`}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("owner.viewPublicProfile")} <ExternalLink size={14} aria-hidden />
            </Link>
            <Link
              to="/manage/classes/new"
              className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:brightness-95"
            >
              <Plus size={16} aria-hidden /> {t("owner.addClass")}
            </Link>
          </div>
        </div>

        <MutationError error={actionError} />

        {classes.isError ? (
          <ErrorState title={t("error.loadClasses")} onRetry={() => classes.refetch()} />
        ) : classes.isLoading ? (
          <div className="space-y-3" aria-label={t("common.loading")}>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays size={21} />}
              title={t("owner.noClasses")}
              message={t("owner.noClassesMsg")}
              action={{ label: t("owner.addClass"), href: "/manage/classes/new" }}
            />
          </Card>
        ) : (
          <>
            <ClassGroup
              title={t("owner.upcomingClasses")}
              emptyText={t("owner.noUpcomingClasses")}
              items={current}
              lang={lang}
              confirmDeleteId={confirmDeleteId}
              busy={update.isPending || remove.isPending}
              onCancel={(item) => setStatus(item, "cancelled")}
              onRestore={(item) => setStatus(item, "open")}
              onAskDelete={setConfirmDeleteId}
              onDelete={deleteItem}
              onKeep={() => setConfirmDeleteId(null)}
              labels={{
                edit: t("common.edit"),
                cancel: t("owner.cancelClass"),
                restore: t("owner.restoreClass"),
                delete: t("owner.deleteClass"),
                deleteConfirm: t("owner.deleteClassConfirm"),
                keep: t("owner.keepClass"),
                open: t("owner.classOpen"),
                soldOut: t("profile.classSoldOut"),
                waitlist: t("profile.classWaitlist"),
                cancelled: t("owner.classCancelled"),
                past: t("group.past"),
              }}
            />
            {past.length > 0 && (
              <ClassGroup
                title={t("owner.pastClasses")}
                isPast
                items={past}
                lang={lang}
                confirmDeleteId={confirmDeleteId}
                busy={update.isPending || remove.isPending}
                onCancel={(item) => setStatus(item, "cancelled")}
                onRestore={(item) => setStatus(item, "open")}
                onAskDelete={setConfirmDeleteId}
                onDelete={deleteItem}
                onKeep={() => setConfirmDeleteId(null)}
                labels={{
                  edit: t("common.edit"),
                  cancel: t("owner.cancelClass"),
                  restore: t("owner.restoreClass"),
                  delete: t("owner.deleteClass"),
                  deleteConfirm: t("owner.deleteClassConfirm"),
                  keep: t("owner.keepClass"),
                  open: t("owner.classOpen"),
                  soldOut: t("profile.classSoldOut"),
                  waitlist: t("profile.classWaitlist"),
                  cancelled: t("owner.classCancelled"),
                  past: t("group.past"),
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface ClassGroupProps {
  title: string;
  emptyText?: string;
  isPast?: boolean;
  items: BusinessClass[];
  lang: "en" | "es";
  confirmDeleteId: string | null;
  busy: boolean;
  onCancel: (item: BusinessClass) => void;
  onRestore: (item: BusinessClass) => void;
  onAskDelete: (id: string) => void;
  onDelete: (id: string) => void;
  onKeep: () => void;
  labels: {
    edit: string;
    cancel: string;
    restore: string;
    delete: string;
    deleteConfirm: string;
    keep: string;
    open: string;
    soldOut: string;
    waitlist: string;
    cancelled: string;
    past: string;
  };
}

function ClassGroup({ title, emptyText, isPast = false, items, lang, confirmDeleteId, busy, onCancel, onRestore, onAskDelete, onDelete, onKeep, labels }: ClassGroupProps) {
  return (
    <section aria-labelledby={`class-group-${title.replace(/\W+/g, "-")}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={`class-group-${title.replace(/\W+/g, "-")}`} className="font-heading text-md font-semibold text-foreground">
          {title}
        </h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <Card className="px-4 py-5 text-sm text-muted-foreground">{emptyText}</Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const deleting = confirmDeleteId === item.id;
            const statusLabel = isPast && item.status !== "cancelled"
              ? labels.past
              : item.status === "open"
              ? labels.open
              : item.status === "sold_out"
                ? labels.soldOut
                : item.status === "waitlist"
                  ? labels.waitlist
                  : labels.cancelled;
            return (
              <Card key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-base font-semibold text-foreground">{item.title}</h3>
                      <StatusBadge tone={!isPast && item.status === "open" ? "positive" : item.status === "cancelled" ? "accent" : "neutral"}>
                        {statusLabel}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatClassDate(item.date, lang)}
                      {item.timeText ? ` · ${item.timeText}` : ""}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                    {item.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <Link
                    to={`/manage/classes/${item.id}/edit`}
                    className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <Pencil size={14} aria-hidden /> {labels.edit}
                  </Link>
                </div>

                {deleting ? (
                  <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3" role="alert">
                    <p className="text-sm text-foreground">{labels.deleteConfirm}</p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={onKeep} disabled={busy}>{labels.keep}</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(item.id)} disabled={busy}>
                        <Trash2 size={14} aria-hidden /> {labels.delete}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {!isPast && item.status === "cancelled" ? (
                      <Button size="sm" variant="ghost" onClick={() => onRestore(item)} disabled={busy}>
                        <RotateCcw size={14} aria-hidden /> {labels.restore}
                      </Button>
                    ) : !isPast ? (
                      <Button size="sm" variant="ghost" onClick={() => onCancel(item)} disabled={busy}>
                        <XCircle size={14} aria-hidden /> {labels.cancel}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => onAskDelete(item.id)} disabled={busy}>
                      <Trash2 size={14} aria-hidden /> {labels.delete}
                    </Button>
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

/** Create/edit form. Keeping it as a child lets async edit data initialize state once. */
export function ClassEditorScreen() {
  return appOnly ? <MainSiteContentHandoff kind="class" /> : <LocalClassEditorScreen />;
}

function LocalClassEditorScreen() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { ownerBusinessId, data: business, isLoading: businessLoading, isError: businessError, refetch: refetchBusiness } = useOwnerBusiness();
  const classes = useManagedBusinessClasses(ownerBusinessId ?? undefined);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (businessError)
    return <ErrorState title={t("error.loadProfile")} onRetry={() => refetchBusiness()} />;
  if (businessLoading || !business || (id && classes.isLoading))
    return <ClassManagerSkeleton title={id ? t("owner.editClass") : t("owner.addClass")} />;
  if (id && classes.isError)
    return <ErrorState title={t("error.loadClasses")} onRetry={() => classes.refetch()} />;

  const item = id ? classes.data?.find((entry) => entry.id === id) : undefined;
  if (id && !item) {
    return (
      <>
        <ScreenHeader title={t("owner.editClass")} back />
        <EmptyState
          icon={<CalendarDays size={21} />}
          title={t("owner.classNotFound")}
          message={t("owner.classNotFoundMsg")}
          action={{ label: t("owner.manageClasses"), href: "/manage/classes" }}
        />
      </>
    );
  }

  return <ClassForm key={item?.id ?? "new"} businessId={ownerBusinessId} initial={item} />;
}

function ClassForm({ businessId, initial }: { businessId: string; initial?: BusinessClass }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const create = useCreateBusinessClass();
  const update = useUpdateBusinessClass();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [timeText, setTimeText] = useState(initial?.timeText ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [status, setStatus] = useState<BusinessClass["status"]>(initial?.status ?? "open");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    setValidationError(null);
    setSubmitError(null);
    const cleanTitle = title.trim();
    if (!cleanTitle || !date) {
      setValidationError(t("owner.classRequiredError"));
      return;
    }
    if (!initial && date < redmondDateYmd()) {
      setValidationError(t("owner.classPastDateError"));
      return;
    }
    const cleanLink = normalizeClassLink(link);
    if (link.trim() && !cleanLink) {
      setValidationError(t("owner.classLinkError"));
      return;
    }

    const values = {
      title: cleanTitle,
      date,
      timeText: timeText.trim() || undefined,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      link: cleanLink,
      status,
    };
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, patch: values });
      } else {
        await create.mutateAsync({
          ...values,
          businessId,
          status: status as ActiveClassStatus,
        });
      }
      navigate("/manage/classes");
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader title={initial ? t("owner.editClass") : t("owner.addClass")} back />
      <div className="space-y-4 px-4 pt-1">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("owner.classFormHint")}</p>
        {initial?.status === "cancelled" && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-foreground">
            {t("owner.cancelledEditHint")}
          </div>
        )}
        <Card className="space-y-4 p-4">
          <Field label={t("owner.classTitle")} required htmlFor="class-title">
            <input id="class-title" className={fieldInputClass} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("owner.classTitlePlaceholder")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("owner.date")} required htmlFor="class-date">
              <input id="class-date" type="date" className={fieldInputClass} min={initial ? undefined : redmondDateYmd()} value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label={t("owner.classAvailability")} htmlFor="class-status">
              <select id="class-status" className={fieldInputClass} value={status} onChange={(event) => setStatus(event.target.value as BusinessClass["status"])} disabled={status === "cancelled"}>
                <option value="open">{t("owner.classOpen")}</option>
                <option value="sold_out">{t("profile.classSoldOut")}</option>
                <option value="waitlist">{t("profile.classWaitlist")}</option>
                {status === "cancelled" && <option value="cancelled">{t("owner.classCancelled")}</option>}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("owner.classTime")} htmlFor="class-time" hint={t("owner.classTimeHint")}>
              <input id="class-time" className={fieldInputClass} maxLength={80} value={timeText} onChange={(event) => setTimeText(event.target.value)} placeholder={t("owner.classTimePlaceholder")} />
            </Field>
            <Field label={t("owner.classLocation")} htmlFor="class-location">
              <input id="class-location" className={fieldInputClass} maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t("owner.classLocationPlaceholder")} />
            </Field>
          </div>
          <Field label={t("owner.classBookingLink")} htmlFor="class-link" hint={t("owner.classLinkHint")}>
            <input id="class-link" type="url" inputMode="url" className={fieldInputClass} maxLength={500} value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://…" />
          </Field>
          <Field label={t("owner.description")} htmlFor="class-description">
            <textarea id="class-description" rows={4} className={fieldInputClass} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("owner.classDescriptionPlaceholder")} />
          </Field>
        </Card>

        {validationError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">{validationError}</p>}
        <MutationError error={submitError} onRetry={submit} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="lg" onClick={() => navigate("/manage/classes")} disabled={pending}>{t("common.cancel")}</Button>
          <Button variant="primary" size="lg" onClick={submit} disabled={pending || !title.trim() || !date}>
            {pending ? t("owner.saving") : initial ? t("owner.saveChanges") : t("owner.createClass")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeClassLink(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function ClassManagerSkeleton({ title }: { title: string }) {
  return (
    <div className="pb-8">
      <ScreenHeader title={title} back />
      <div className="space-y-3 px-4 pt-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}
