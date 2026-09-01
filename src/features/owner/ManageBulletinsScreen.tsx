import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Archive, ExternalLink, Megaphone, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  useBulletinCount,
  useBulletins,
  useCreateBulletin,
  useDeleteBulletin,
  useUpdateBulletin,
} from "@/data/queries";
import { eventStartToUtc } from "@/lib/calendar";
import { bulletinAllowance, LIMITS } from "@/lib/entitlements";
import { relativeTime, redmondDateYmd } from "@/lib/format";
import type { Bulletin } from "@/lib/types";
import { getLocale, useI18n } from "@/i18n";
import { MutationError } from "./MutationError";
import { useOwnerBusiness } from "./useOwnerBusiness";

const MAX = 280;

export function ManageBulletinsScreen() {
  const { t, lang } = useI18n();
  const { ownerBusinessId, data: business, isLoading: businessLoading, isError: businessError, refetch: refetchBusiness } = useOwnerBusiness();
  const bulletins = useBulletins({ businessId: ownerBusinessId ?? undefined, status: "all" });
  const update = useUpdateBulletin();
  const remove = useDeleteBulletin();
  const [actionError, setActionError] = useState<unknown>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (businessError) return <ErrorState title={t("error.loadProfile")} onRetry={() => refetchBusiness()} />;
  if (businessLoading || !business) return <ManagerSkeleton title={t("owner.manageBulletins")} />;

  const items = bulletins.data ?? [];
  const active = items.filter((item) => item.status !== "expired");
  const archived = items.filter((item) => item.status === "expired");
  const busy = update.isPending || remove.isPending;

  const setStatus = async (item: Bulletin, status: Bulletin["status"]) => {
    setActionError(null);
    setConfirmDeleteId(null);
    try {
      await update.mutateAsync({
        id: item.id,
        // Restoring is a new publication action, so it consumes a slot in the current
        // month instead of reviving an old post outside the cap.
        patch: status === "live" ? { status, scheduledFor: new Date().toISOString() } : { status },
      });
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
      <ScreenHeader title={t("owner.manageBulletins")} back />
      <div className="space-y-5 px-4 pt-1">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{business.name}</p>
            <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-muted-foreground">{t("owner.bulletinsHint")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to={`/b/${business.slug}`} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted">
              {t("owner.viewPublicProfile")} <ExternalLink size={14} aria-hidden />
            </Link>
            <Link to="/manage/bulletin/new" className="inline-flex min-h-tap items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:brightness-95">
              <Plus size={16} aria-hidden /> {t("owner.postBulletin")}
            </Link>
          </div>
        </div>

        <MutationError error={actionError} />
        {bulletins.isError ? (
          <ErrorState title={t("error.loadBulletins")} onRetry={() => bulletins.refetch()} />
        ) : bulletins.isLoading ? (
          <div className="space-y-3" aria-label={t("common.loading")}><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /></div>
        ) : items.length === 0 ? (
          <Card><EmptyState icon={<Megaphone size={21} />} title={t("owner.noBulletins")} message={t("owner.noBulletinsMsg")} action={{ label: t("owner.postBulletin"), href: "/manage/bulletin/new" }} /></Card>
        ) : (
          <>
            <BulletinGroup
              title={t("owner.activeBulletins")}
              emptyText={t("owner.noActiveBulletins")}
              items={active}
              lang={lang}
              confirmDeleteId={confirmDeleteId}
              busy={busy}
              onArchive={(item) => setStatus(item, "expired")}
              onRestore={(item) => setStatus(item, "live")}
              onAskDelete={setConfirmDeleteId}
              onDelete={deleteItem}
              onKeep={() => setConfirmDeleteId(null)}
            />
            {archived.length > 0 && (
              <BulletinGroup
                title={t("owner.archivedBulletins")}
                items={archived}
                lang={lang}
                confirmDeleteId={confirmDeleteId}
                busy={busy}
                onArchive={(item) => setStatus(item, "expired")}
                onRestore={(item) => setStatus(item, "live")}
                onAskDelete={setConfirmDeleteId}
                onDelete={deleteItem}
                onKeep={() => setConfirmDeleteId(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface BulletinGroupProps {
  title: string;
  emptyText?: string;
  items: Bulletin[];
  lang: "en" | "es";
  confirmDeleteId: string | null;
  busy: boolean;
  onArchive: (item: Bulletin) => void;
  onRestore: (item: Bulletin) => void;
  onAskDelete: (id: string) => void;
  onDelete: (id: string) => void;
  onKeep: () => void;
}

function BulletinGroup({ title, emptyText, items, lang, confirmDeleteId, busy, onArchive, onRestore, onAskDelete, onDelete, onKeep }: BulletinGroupProps) {
  const { t } = useI18n();
  const locale = lang === "es" ? "es-US" : "en-US";
  return (
    <section aria-labelledby={`bulletin-group-${title.replace(/\W+/g, "-")}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id={`bulletin-group-${title.replace(/\W+/g, "-")}`} className="font-heading text-md font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? <Card className="px-4 py-5 text-sm text-muted-foreground">{emptyText}</Card> : (
        <div className="space-y-3">
          {items.map((item) => {
            const deleting = confirmDeleteId === item.id;
            const label = item.status === "live" ? t("owner.bulletinLive") : item.status === "scheduled" ? t("owner.bulletinScheduled") : item.status === "draft" ? t("owner.bulletinDraft") : t("owner.bulletinArchived");
            return (
              <Card key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={item.status === "live" ? "positive" : item.status === "scheduled" ? "info" : "neutral"}>{label}</StatusBadge>
                      <span className="text-xs text-muted-foreground">{relativeTime(item.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{item.body}</p>
                    {item.scheduledFor && item.status === "scheduled" && (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">{t("owner.scheduledFor", { date: new Date(item.scheduledFor).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" }) })}</p>
                    )}
                  </div>
                  <Link to={`/manage/bulletins/${item.id}/edit`} className="inline-flex min-h-tap items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-muted">
                    <Pencil size={14} aria-hidden /> {t("common.edit")}
                  </Link>
                </div>
                {deleting ? (
                  <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3" role="alert">
                    <p className="text-sm text-foreground">{t("owner.deleteBulletinConfirm")}</p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={onKeep} disabled={busy}>{t("owner.keepBulletin")}</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(item.id)} disabled={busy}><Trash2 size={14} aria-hidden /> {t("owner.deleteBulletin")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {item.status === "expired" ? (
                      <Button size="sm" variant="ghost" onClick={() => onRestore(item)} disabled={busy}><RotateCcw size={14} aria-hidden /> {t("owner.restoreBulletin")}</Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => onArchive(item)} disabled={busy}><Archive size={14} aria-hidden /> {t("owner.archiveBulletin")}</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => onAskDelete(item.id)} disabled={busy}><Trash2 size={14} aria-hidden /> {t("owner.deleteBulletin")}</Button>
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

export function BulletinEditorScreen() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { ownerBusinessId, data: business, isLoading: businessLoading, isError: businessError, refetch: refetchBusiness } = useOwnerBusiness();
  const bulletins = useBulletins({ businessId: ownerBusinessId ?? undefined, status: "all" });
  const count = useBulletinCount(ownerBusinessId ?? undefined);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (businessError || count.isError) return <ErrorState title={t("error.loadProfile")} onRetry={() => { refetchBusiness(); count.refetch(); }} />;
  if (businessLoading || !business || count.isLoading || (id && bulletins.isLoading)) return <ManagerSkeleton title={id ? t("owner.editBulletin") : t("owner.postBulletin")} />;
  if (id && bulletins.isError) return <ErrorState title={t("error.loadBulletins")} onRetry={() => bulletins.refetch()} />;
  const item = id ? bulletins.data?.find((entry) => entry.id === id) : undefined;
  if (id && !item) return <><ScreenHeader title={t("owner.editBulletin")} back /><EmptyState icon={<Megaphone size={21} />} title={t("owner.bulletinNotFound")} message={t("owner.bulletinNotFoundMsg")} action={{ label: t("owner.manageBulletins"), href: "/manage/bulletins" }} /></>;
  return <BulletinForm key={item?.id ?? "new"} businessId={ownerBusinessId} initial={item} used={count.data ?? 0} />;
}

function BulletinForm({ businessId, initial, used }: { businessId: string; initial?: Bulletin; used: number }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const create = useCreateBulletin();
  const update = useUpdateBulletin();
  const [body, setBody] = useState(initial?.body ?? "");
  const [linkLabel, setLinkLabel] = useState(initial?.linkCta?.label ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkCta?.url ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const pending = create.isPending || update.isPending;
  const cap = LIMITS.free.bulletinsPerMonth ?? 0;
  const allowance = bulletinAllowance("free", used);
  const remaining = allowance.remaining === Infinity ? null : allowance.remaining;
  const resetYmd = firstOfNextMonth(redmondDateYmd());
  const scheduledFor = eventStartToUtc(`${resetYmd}T00:05:00`).toISOString();
  const resetLabel = new Date(`${resetYmd}T12:00:00`).toLocaleDateString(getLocale(), { month: "long", day: "numeric" });

  const submit = async () => {
    setValidationError(null);
    setSubmitError(null);
    const cleanBody = body.trim();
    if (!cleanBody) return setValidationError(t("owner.bulletinRequiredError"));
    const hasLabel = !!linkLabel.trim();
    const hasUrl = !!linkUrl.trim();
    if (hasLabel !== hasUrl) return setValidationError(t("owner.bulletinLinkPairError"));
    const cleanUrl = hasUrl ? normalizeWebLink(linkUrl) : undefined;
    if (hasUrl && !cleanUrl) return setValidationError(t("owner.bulletinLinkError"));
    const linkCta = hasLabel && cleanUrl ? { label: linkLabel.trim(), url: cleanUrl } : undefined;
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, patch: { body: cleanBody, linkCta } });
      } else {
        const schedule = !allowance.canPostNow;
        await create.mutateAsync({ businessId, body: cleanBody, linkCta, ...(schedule ? { scheduledFor, status: "scheduled" as const } : { status: "live" as const }) });
      }
      navigate("/manage/bulletins");
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader title={initial ? t("owner.editBulletin") : t("owner.postBulletin")} back />
      <div className="space-y-4 px-4 pt-1">
        <p className="text-sm leading-relaxed text-muted-foreground">{t("owner.bulletinFormHint")}</p>
        {!initial && remaining !== null && <p className="text-sm text-muted-foreground">{allowance.canPostNow ? t("owner.postsLeft", { n: remaining, cap }) : t("owner.postsUsed", { cap })}</p>}
        <Card className="space-y-4 p-4">
          <Field label={t("owner.bulletinLabel")} required htmlFor="b-body" hint={`${body.length}/${MAX}`}>
            <textarea id="b-body" rows={5} maxLength={MAX} className={fieldInputClass} value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("owner.bulletinPlaceholder")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("owner.linkLabel")} htmlFor="b-ll"><input id="b-ll" className={fieldInputClass} maxLength={80} value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Order now" /></Field>
            <Field label={t("owner.linkUrl")} htmlFor="b-lu"><input id="b-lu" type="url" inputMode="url" className={fieldInputClass} maxLength={500} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" /></Field>
          </div>
        </Card>
        {!initial && !allowance.canPostNow && <div className="rounded-lg border border-positive/30 bg-positive/5 p-3 text-sm text-foreground"><p className="font-semibold text-positive">{t("owner.capSafe")}</p><p className="mt-1 text-muted-foreground">{t("owner.capScheduleMsg", { date: resetLabel })}</p></div>}
        {validationError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">{validationError}</p>}
        <MutationError error={submitError} onRetry={submit} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="lg" onClick={() => navigate("/manage/bulletins")} disabled={pending}>{t("common.cancel")}</Button>
          <Button variant={initial || allowance.canPostNow ? "primary" : "positive"} size="lg" onClick={submit} disabled={pending || !body.trim()}>
            {pending ? (initial ? t("owner.saving") : allowance.canPostNow ? t("owner.posting") : t("owner.scheduling")) : initial ? t("owner.saveChanges") : allowance.canPostNow ? t("owner.postNow") : t("owner.scheduleFree", { date: resetLabel })}
          </Button>
        </div>
      </div>
    </div>
  );
}

function firstOfNextMonth(ymd: string): string {
  const [year, month] = ymd.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function normalizeWebLink(value: string): string | undefined {
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

function ManagerSkeleton({ title }: { title: string }) {
  return <div className="pb-8"><ScreenHeader title={title} back /><div className="space-y-3 px-4 pt-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div></div>;
}
