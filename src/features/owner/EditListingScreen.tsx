import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Check, X, Plus, ArrowRight } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import {
  Field,
  fieldInputClass,
  CompletenessMeter,
  Chip,
  Switch,
  Thumb,
  Button,
  Card,
  Skeleton,
} from "@/components";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { useUpdateBusiness } from "@/data/queries";
import { listingCompleteness } from "@/lib/completeness";
import { WEEKDAY_ORDER, dayLabel } from "@/lib/hours";
import { AMENITY_FACETS, BUSINESS_CATEGORIES } from "@/lib/taxonomy";
import { LIMITS } from "@/lib/entitlements";
import type { Business, DayHours, Weekday } from "@/lib/types";
import { useI18n } from "@/i18n";

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
}

const blankWeek = (): Week =>
  Object.fromEntries(WEEKDAY_ORDER.map((d) => [d, { open: "", close: "", closed: true }])) as Week;

function fromBusiness(b: Business): FormState {
  const week = blankWeek();
  if (b.hours) for (const d of WEEKDAY_ORDER) week[d] = { ...b.hours.week[d] };
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
  };
}

/** Edit Listing (B4) — free, current-site parity. Member "enhanced profile" fields
 *  (story/menu/gallery) are deferred and not rendered (no modules at MVP). */
export function EditListingScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { ownerBusinessId, data: business, isLoading } = useOwnerBusiness();
  const update = useUpdateBusiness();
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (business && !form) setForm(fromBusiness(business));
  }, [business, form]);

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
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
    hours: { week: form.week },
  };
  const { percent, nextAction } = listingCompleteness(preview);

  const setWeek = (d: Weekday, patch: Partial<DayHours>) =>
    setForm((f) => (f ? { ...f, week: { ...f.week, [d]: { ...f.week[d], ...patch } } } : f));

  const toggleTag = (t: string) =>
    setForm((f) =>
      f
        ? { ...f, amenityTags: f.amenityTags.includes(t) ? f.amenityTags.filter((x) => x !== t) : [...f.amenityTags, t] }
        : f,
    );

  const save = async () => {
    await update.mutateAsync({
      id: business.id,
      patch: {
        name: form.name.trim(),
        category: form.category,
        subcategories: preview.subcategories,
        description: form.description.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        photos: form.photos,
        amenityTags: form.amenityTags,
        hours: { week: form.week },
      },
    });
    navigate("/manage");
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
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                >
                  <X size={12} />
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
              <select id="e-cat" className={fieldInputClass} value={form.category} onChange={(e) => setForm((f) => f && { ...f, category: e.target.value })}>
                {BUSINESS_CATEGORIES.map((c) => (
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
                      <input type="time" value={dh.open} onChange={(e) => setWeek(d, { open: e.target.value })} className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
                      <span className="text-muted-foreground">–</span>
                      <input type="time" value={dh.close} onChange={(e) => setWeek(d, { close: e.target.value })} className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
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

        <Link to={`/b/${business.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-positive hover:underline">
          {t("owner.previewProfile")} <ArrowRight size={14} />
        </Link>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-content border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Button variant="primary" size="lg" fullWidth disabled={update.isPending || !form.name.trim() || !form.address.trim()} onClick={save}>
          {update.isPending ? t("owner.saving") : t("owner.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
