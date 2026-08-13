import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Field, fieldInputClass, Button, Card, Skeleton, ErrorState } from "@/components";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { MutationError } from "./MutationError";
import { useCreateEvent } from "@/data/queries";
import { useI18n } from "@/i18n";

const CATEGORIES = ["Music", "Community", "Family", "Festival", "Outdoors", "Workshop", "Food & Drink", "Other"];

/** Submit Event (B3) — free and uncapped for all tiers. Tied to the owner's business. */
export function SubmitEventScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { ownerBusinessId, data: business, isLoading, isError, refetch } = useOwnerBusiness();
  const create = useCreateEvent();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");

  if (!ownerBusinessId) return <Navigate to="/claim" replace />;
  // See EditListingScreen: without this, an error leaves the skeleton up permanently.
  if (isError) return <ErrorState title={t("error.loadProfile")} onRetry={() => refetch()} />;
  if (isLoading || !business) {
    return (
      <>
        <ScreenHeader title={t("owner.submitEvent")} back />
        <div className="space-y-3 px-4 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </>
    );
  }

  const valid = title.trim() && date && start;

  const submit = async () => {
    if (!valid) return;
    // The form state is untouched on failure, so the owner's typing survives and the same
    // button is the retry. `mutateAsync` rejecting used to be an unhandled rejection: the
    // button re-enabled, nothing navigated, and nothing explained why.
    setSubmitError(null);
    try {
      await create.mutateAsync({
        businessId: ownerBusinessId,
        title: title.trim(),
        startAt: `${date}T${start}:00`,
        endAt: end ? `${date}T${end}:00` : undefined,
        venueName: venue.trim() || business.name,
        address: address.trim() || business.address,
        geo: business.geo,
        description: description.trim() || undefined,
        category,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      navigate("/manage");
    } catch (e) {
      setSubmitError(e);
    }
  };

  return (
    <div className="pb-8">
      <ScreenHeader title={t("owner.submitEvent")} back />

      <div className="space-y-4 px-4 pt-1">
        <p className="text-sm text-muted-foreground">
          {t("owner.eventsFree")}
        </p>

        <Card className="space-y-3.5 p-4">
          <Field label={t("owner.eventTitle")} required htmlFor="ev-title">
            <input id="ev-title" className={fieldInputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Live acoustic night" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("owner.date")} required htmlFor="ev-date">
              <input id="ev-date" type="date" className={fieldInputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("owner.start")} required htmlFor="ev-start">
              <input id="ev-start" type="time" className={fieldInputClass} value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label={t("owner.end")} htmlFor="ev-end">
              <input id="ev-end" type="time" className={fieldInputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <Field label={t("owner.venue")} htmlFor="ev-venue" hint={t("owner.venueHint")}>
            <input id="ev-venue" className={fieldInputClass} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder={business.name} />
          </Field>
          <Field label={t("owner.address")} htmlFor="ev-addr" hint={t("owner.addressHint")}>
            <input id="ev-addr" className={fieldInputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={business.address} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("owner.category")} htmlFor="ev-cat">
              <select id="ev-cat" className={fieldInputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label={t("owner.tags")} htmlFor="ev-tags" hint={t("owner.tagsHint")}>
              <input id="ev-tags" className={fieldInputClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Free, Family" />
            </Field>
          </div>
          <Field label={t("owner.description")} htmlFor="ev-desc">
            <textarea id="ev-desc" rows={3} className={fieldInputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("owner.eventDescPlaceholder")} />
          </Field>
        </Card>

        <MutationError error={submitError} onRetry={submit} />

        <Button variant="primary" size="lg" fullWidth disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending ? t("owner.submitting") : <><CalendarPlus size={16} /> {t("owner.submitEventBtn")}</>}
        </Button>
      </div>
    </div>
  );
}
