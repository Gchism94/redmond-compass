import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Field, fieldInputClass, Button, Card, Skeleton } from "@/components";
import { useOwnerBusiness } from "./useOwnerBusiness";
import { useCreateEvent } from "@/data/queries";

const CATEGORIES = ["Music", "Community", "Family", "Festival", "Outdoors", "Workshop", "Food & Drink", "Other"];

/** Submit Event (B3) — free and uncapped for all tiers. Tied to the owner's business. */
export function SubmitEventScreen() {
  const navigate = useNavigate();
  const { ownerBusinessId, data: business, isLoading } = useOwnerBusiness();
  const create = useCreateEvent();

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
  if (isLoading || !business) {
    return (
      <>
        <ScreenHeader title="Submit event" back />
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
  };

  return (
    <div className="pb-8">
      <ScreenHeader title="Submit an event" back />

      <div className="space-y-4 px-4 pt-1">
        <p className="text-sm text-muted-foreground">
          Events are free and unlimited — they appear on your profile and in the Events tab.
        </p>

        <Card className="space-y-3.5 p-4">
          <Field label="Event title" required htmlFor="ev-title">
            <input id="ev-title" className={fieldInputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Live acoustic night" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date" required htmlFor="ev-date">
              <input id="ev-date" type="date" className={fieldInputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Start" required htmlFor="ev-start">
              <input id="ev-start" type="time" className={fieldInputClass} value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="End" htmlFor="ev-end">
              <input id="ev-end" type="time" className={fieldInputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Venue" htmlFor="ev-venue" hint="Defaults to your business name">
            <input id="ev-venue" className={fieldInputClass} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder={business.name} />
          </Field>
          <Field label="Address" htmlFor="ev-addr" hint="Defaults to your business address">
            <input id="ev-addr" className={fieldInputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={business.address} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="ev-cat">
              <select id="ev-cat" className={fieldInputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags" htmlFor="ev-tags" hint="Comma-separated">
              <input id="ev-tags" className={fieldInputClass} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Free, Family" />
            </Field>
          </div>
          <Field label="Description" htmlFor="ev-desc">
            <textarea id="ev-desc" rows={3} className={fieldInputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's happening?" />
          </Field>
        </Card>

        <Button variant="primary" size="lg" fullWidth disabled={!valid || create.isPending} onClick={submit}>
          {create.isPending ? "Submitting…" : <><CalendarPlus size={16} /> Submit event</>}
        </Button>
      </div>
    </div>
  );
}
