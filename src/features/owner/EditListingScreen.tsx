import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Check, X, Plus, ArrowRight, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Field, fieldInputClass, CompletenessMeter, Chip, Switch, Thumb, Button, Card, Skeleton, ErrorState } from "@/components";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { MutationError } from "./MutationError";
import { useUpdateBusiness } from "@/data/queries";
import { listingCompleteness } from "@/lib/completeness";
import { WEEKDAY_ORDER, dayLabel, formatClock, hasValidWeeklyHours } from "@/lib/hours";
import { AMENITY_FACETS, BUSINESS_CATEGORIES, categoryLabelFor } from "@/lib/taxonomy";
import { LIMITS } from "@/lib/entitlements";
import type { Business, DayHours, Weekday } from "@/lib/types";
import { useI18n } from "@/i18n";
import { appOnly, LIVE_SITE } from "@/lib/siteMode";

type Week = Record<Weekday, DayHours>;

interface FormState {
  name: string;
  category: string;
  subcategories: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  photos: string[];
  amenityTags: string[];
  week: Week;
  hoursEnabled: boolean;
}

/**
 * The <select>'s options for a listing whose stored category may be the SHEET's vocabulary.
 *
 * `form.category` deliberately keeps the STORED value ("food-drink"). A <select> whose
 * `value` matches no <option> renders with nothing selected, so an owner editing a synced
 * listing saw a blank category box. The fix is display-only, mirroring categoryLabelFor():
 * the select is driven by the resolved LABEL, and if that label isn't already one of the
 * offered options (an uncategorised value like "Entertainment") it is appended so the owner
 * sees their real category instead of a blank — still a label, never raw slug-case.
 */
function categoryOptions(storedValue: string): string[] {
  const label = categoryLabelFor(storedValue);
  return label && !BUSINESS_CATEGORIES.includes(label)
    ? [...BUSINESS_CATEGORIES, label]
    : BUSINESS_CATEGORIES;
}

/**
 * Did the owner actually pick a DIFFERENT category, or is this the same one spelled the
 * other way? Compared by label, so re-selecting "Food & Drink" on a listing stored as
 * "food-drink" counts as untouched — otherwise an idle click would rewrite the value and
 * the next Sheet sync would immediately flip it back, churning the row for nothing.
 */
const categoryChanged = (picked: string, stored: string) =>
  categoryLabelFor(picked) !== categoryLabelFor(stored);

const blankWeek = (): Week =>
  Object.fromEntries(WEEKDAY_ORDER.map((d) => [d, { open: "", close: "", closed: true }])) as Week;

function fromBusiness(b: Business): FormState {
  const week = blankWeek();
  const structuredHours = hasValidWeeklyHours(b.hours) ? b.hours : undefined;
  if (structuredHours) for (const d of WEEKDAY_ORDER) week[d] = { ...structuredHours.week[d] };
  return {
    name: b.name,
    category: b.category,
    subcategories: (b.subcategories ?? []).join(", "),
    description: b.description,
    address: b.address,
    phone: b.phone ?? "",
    website: b.website ?? "",
    photos: [...b.photos],
    amenityTags: [...b.amenityTags],
    week,
    hoursEnabled: !!structuredHours,
  };
}

export function EditListingScreen() {
  return appOnly ? <MainSiteListingHandoff /> : <LocalEditListingScreen />;
}

function listingDetailsText(business: Business, labels: {
  category: string;
  subcategories: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  longDescription: string;
  photos: string;
  socialLinks: string;
  license: string;
  specials: string;
  additionalLocations: string;
  hours: string;
  closed: string;
  notListed: string;
}): string {
  const weekly = hasValidWeeklyHours(business.hours)
    ? WEEKDAY_ORDER.map((day) => {
        const value = business.hours!.week[day];
        return `${dayLabel(day)}: ${value.closed ? labels.closed : `${formatClock(value.open)}–${formatClock(value.close)}`}`;
      }).join("\n")
    : business.hoursText?.trim() || labels.notListed;
  return [
    business.name,
    `${labels.category}: ${categoryLabelFor(business.category)}`,
    business.subcategories?.length ? `${labels.subcategories}: ${business.subcategories.join(", ")}` : "",
    `${labels.address}: ${business.address || labels.notListed}`,
    `${labels.phone}: ${business.phone || labels.notListed}`,
    `${labels.email}: ${business.email || labels.notListed}`,
    `${labels.website}: ${business.website || labels.notListed}`,
    `${labels.description}: ${business.description || labels.notListed}`,
    business.longDescription ? `${labels.longDescription}: ${business.longDescription}` : "",
    business.photos?.length ? `${labels.photos}: ${business.photos.join(", ")}` : "",
    business.socials && Object.keys(business.socials).length
      ? `${labels.socialLinks}: ${Object.entries(business.socials).map(([network, url]) => `${network}: ${url}`).join(", ")}`
      : "",
    business.licenseNumber || business.licenseType
      ? `${labels.license}: ${[business.licenseType, business.licenseNumber].filter(Boolean).join(" — ")}`
      : "",
    business.specials ? `${labels.specials}: ${business.specials}` : "",
    business.additionalLocations?.length
      ? `${labels.additionalLocations}: ${JSON.stringify(business.additionalLocations)}`
      : "",
    `${labels.hours}:`,
    weekly,
  ].filter(Boolean).join("\n");
}

/**
 * In app-only mode the owner's Base44/GHL workflow is authoritative. This handoff keeps
 * canonical directory edits out of Supabase, where the next inbound refresh could undo
 * them, while still giving an owner a copyable packet when the app contains richer data.
 */
function MainSiteListingHandoff() {
  const { t } = useI18n();
  const { ownerBusinessId, data: business, isLoading, isError, refetch } = useOwnerBusiness();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  if (isError) return <ErrorState title={t("error.loadProfile")} onRetry={() => refetch()} />;
  if (isLoading || !business) {
    return <><ScreenHeader title={t("owner.editListing")} back /><div className="px-4 pt-2"><Skeleton className="h-72 w-full" /></div></>;
  }

  const details = listingDetailsText(business, {
    category: t("owner.category"),
    subcategories: t("owner.subcategories"),
    address: t("owner.address"),
    phone: t("owner.phone"),
    email: t("owner.email"),
    website: t("owner.website"),
    description: t("owner.description"),
    longDescription: t("owner.longDescription"),
    photos: t("owner.photos"),
    socialLinks: t("owner.socialLinks"),
    license: t("owner.license"),
    specials: t("owner.specials"),
    additionalLocations: t("owner.additionalLocations"),
    hours: t("owner.hours"),
    closed: t("owner.closed"),
    notListed: t("owner.notListed"),
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader title={t("owner.mainSiteHandoffTitle")} back />
      <div className="space-y-4 px-4 pt-2">
        <Card className="border-positive/25 bg-positive/5 p-4">
          <div className="flex items-start gap-3">
            <RefreshCw size={20} className="mt-0.5 shrink-0 text-positive" aria-hidden />
            <div>
              <h2 className="font-heading text-md font-semibold text-foreground">{t("owner.mainSiteSourceTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("owner.mainSiteHandoffBody")}</p>
            </div>
          </div>
          <a
            href={`${LIVE_SITE}/dashboard`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
          >
            {t("owner.openMainSiteDashboard")} <ExternalLink size={16} />
          </a>
        </Card>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("owner.appDetailsLabel")}</h2>
          <textarea
            readOnly
            value={details}
            rows={12}
            aria-label={t("owner.appDetailsLabel")}
            className={`${fieldInputClass} h-auto resize-y py-3 font-mono text-xs leading-relaxed`}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button variant="ghost" fullWidth className="mt-2" onClick={copy}>
            {copyState === "copied" ? <><Check size={16} /> {t("owner.detailsCopied")}</> : <><Copy size={16} /> {t("owner.copyAppDetails")}</>}
          </Button>
          {copyState === "failed" && <p role="alert" className="mt-2 text-xs text-danger">{t("owner.copyFailed")}</p>}
        </section>
      </div>
    </div>
  );
}

/** Edit Listing (B4) in full-site mode. Member "enhanced profile" fields
 *  (story/menu/gallery) are deferred and not rendered (no modules at MVP). */
function LocalEditListingScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { ownerBusinessId, data: business, isLoading, isError, refetch } = useOwnerBusiness();
  const update = useUpdateBusiness();
  const [form, setForm] = useState<FormState | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    if (business && !form) setForm(fromBusiness(business));
  }, [business, form]);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  // Before the loading guard: `isLoading || !business` stays TRUE on error (isLoading goes
  // false, business stays undefined), so the screen used to show a skeleton forever.
  if (isError) return <ErrorState title={t("error.loadProfile")} onRetry={() => refetch()} />;
  if (isLoading || !form || !business) {
    return (
      <>
        <ScreenHeader title={t("owner.editListing")} back />
        <div className="space-y-3 px-4 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </>
    );
  }

  const photoCap = LIMITS.free.photos ?? 5;
  const structuredHours = { week: form.week };
  const scheduleValid = hasValidWeeklyHours(structuredHours);
  const preview: Business = {
    ...business,
    name: form.name,
    category: form.category,
    subcategories: form.subcategories.split(",").map((s) => s.trim()).filter(Boolean),
    description: form.description,
    address: form.address,
    phone: form.phone || undefined,
    website: form.website || undefined,
    photos: form.photos,
    amenityTags: form.amenityTags,
    hours: scheduleValid ? structuredHours : undefined,
  };
  const { percent, nextAction } = listingCompleteness(preview);

  const setWeek = (d: Weekday, patch: Partial<DayHours>) =>
    setForm((f) => (f ? { ...f, hoursEnabled: true, week: { ...f.week, [d]: { ...f.week[d], ...patch } } } : f));

  const toggleTag = (t: string) =>
    setForm((f) =>
      f
        ? { ...f, amenityTags: f.amenityTags.includes(t) ? f.amenityTags.filter((x) => x !== t) : [...f.amenityTags, t] }
        : f,
    );

  const save = async () => {
    // Edits are lost work if they vanish — the form state is deliberately NOT reset on
    // failure, so the owner can fix the cause (reconnect, sign in) and press Save again.
    setSaveError(null);
    try {
      await update.mutateAsync({
        id: business.id,
        patch: {
          name: form.name.trim(),
          // Only written when the owner genuinely picked a different category. Otherwise
          // it is omitted from the patch entirely, so the synced value passes through
          // untouched and the next sync has nothing to fight.
          ...(categoryChanged(form.category, business.category) ? { category: form.category } : {}),
          subcategories: preview.subcategories,
          description: form.description.trim(),
          address: form.address.trim(),
          phone: form.phone.trim() || undefined,
          website: form.website.trim() || undefined,
          photos: form.photos,
          amenityTags: form.amenityTags,
          ...(scheduleValid ? { hours: structuredHours } : {}),
        },
      });
      navigate("/manage");
    } catch (e) {
      setSaveError(e);
    }
  };

  return (
    <div className="pb-24">
      <ScreenHeader title={t("owner.editListing")} back />

      <div className="space-y-4 px-4 pt-1">
        {/* Completeness */}
        <Card className="p-4">
          <CompletenessMeter value={percent} nextAction={nextAction} />
        </Card>

        {/* Photos */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("owner.photos")} <span className="font-normal normal-case">{form.photos.length}/{photoCap}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {form.photos.map((p, i) => (
              <div key={i} className="relative">
                <Thumb src={p} seed={form.name} alt="" className="h-16 w-16" rounded="rounded-lg" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => setForm((f) => (f ? { ...f, photos: f.photos.filter((_, j) => j !== i) } : f))}
                  className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center rounded-full text-background"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground shadow-sm">
                    <X size={13} />
                  </span>
                </button>
              </div>
            ))}
            {form.photos.length < photoCap && (
              <button
                type="button"
                onClick={() =>
                  setForm((f) => (f ? { ...f, photos: [...f.photos, `/mock/added-${f.photos.length + 1}.jpg`] } : f))
                }
                className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Up to {photoCap} photos on a free listing. (Upload connects to the backend; the + adds a placeholder for now.)
          </p>
        </section>

        {/* Core fields */}
        <Card className="space-y-3.5 p-4">
          <Field label={t("owner.bizName")} required htmlFor="e-name">
            <input id="e-name" className={fieldInputClass} value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("owner.category")} htmlFor="e-cat">
              <select
                id="e-cat"
                className={fieldInputClass}
                /* the LABEL drives the selected state; form.category keeps the stored value */
                value={categoryLabelFor(form.category)}
                onChange={(e) => setForm((f) => f && { ...f, category: e.target.value })}
              >
                {categoryOptions(form.category).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label={t("owner.subcategories")} htmlFor="e-sub">
              <input id="e-sub" className={fieldInputClass} value={form.subcategories} onChange={(e) => setForm((f) => f && { ...f, subcategories: e.target.value })} placeholder="Coffee, Breakfast" />
            </Field>
          </div>
          <Field label={t("owner.shortDesc")} htmlFor="e-desc">
            <textarea id="e-desc" rows={3} className={fieldInputClass} value={form.description} onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })} />
          </Field>
          <Field label={t("owner.address")} required htmlFor="e-addr">
            <input id="e-addr" className={fieldInputClass} value={form.address} onChange={(e) => setForm((f) => f && { ...f, address: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("owner.phone")} htmlFor="e-phone">
              <input id="e-phone" className={fieldInputClass} value={form.phone} onChange={(e) => setForm((f) => f && { ...f, phone: e.target.value })} inputMode="tel" />
            </Field>
            <Field label={t("owner.website")} htmlFor="e-web">
              <input id="e-web" className={fieldInputClass} value={form.website} onChange={(e) => setForm((f) => f && { ...f, website: e.target.value })} inputMode="url" />
            </Field>
          </div>
        </Card>

        {/* Hours */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("owner.hours")}</h2>
          {form.hoursEnabled ? (
            <>
              <Card className="divide-y divide-border p-0">
                {WEEKDAY_ORDER.map((d) => {
                  const dh = form.week[d];
                  return (
                    <div key={d} className="flex items-center gap-2 px-3 py-2.5">
                      <span className="w-10 shrink-0 text-sm font-medium text-foreground">{dayLabel(d)}</span>
                      {dh.closed ? (
                        <span className="flex-1 text-sm text-muted-foreground">{t("owner.closed")}</span>
                      ) : (
                        <div className="flex flex-1 items-center gap-1.5">
                          <input type="time" value={dh.open} onChange={(e) => setWeek(d, { open: e.target.value })} className="min-h-tap min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-sm" />
                          <span className="text-muted-foreground">–</span>
                          <input type="time" value={dh.close} onChange={(e) => setWeek(d, { close: e.target.value })} className="min-h-tap min-w-0 flex-1 rounded-md border border-border bg-card px-2 text-sm" />
                        </div>
                      )}
                      <Switch
                        checked={!dh.closed}
                        onChange={(open) => setWeek(d, open ? { closed: false, open: dh.open || "09:00", close: dh.close || "17:00" } : { closed: true })}
                        label={`${dayLabel(d)} open`}
                      />
                    </div>
                  );
                })}
              </Card>
              {!scheduleValid && (
                <p className="mt-2 text-xs leading-relaxed text-danger">{t("owner.hoursAccuracyHint")}</p>
              )}
            </>
          ) : (
            <Card className="p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {business.hoursText?.trim() || t("status.hoursNotListed")}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("owner.hoursAccuracyHint")}</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-3"
                onClick={() => setForm((f) => (f ? { ...f, hoursEnabled: true } : f))}
              >
                <Plus size={15} /> {t("owner.addWeeklyHours")}
              </Button>
            </Card>
          )}
        </section>

        {/* Amenity tags */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("owner.amenityTags")}</h2>
          <div className="flex flex-wrap gap-2">
            {AMENITY_FACETS.map((t) => (
              <Chip key={t} active={form.amenityTags.includes(t)} onClick={() => toggleTag(t)}>
                {form.amenityTags.includes(t) && <Check size={12} />} {t}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("owner.amenityHint")}</p>
        </section>

        <Link to={`/b/${business.slug}`} className="inline-flex min-h-tap items-center gap-1 text-sm font-semibold text-positive hover:underline">
          {t("owner.previewProfile")} <ArrowRight size={14} />
        </Link>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-content border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <MutationError error={saveError} onRetry={save} />

        <Button variant="primary" size="lg" fullWidth disabled={update.isPending || !form.name.trim() || !form.address.trim() || (form.hoursEnabled && !scheduleValid)} onClick={save}>
          {update.isPending ? t("owner.saving") : t("owner.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
