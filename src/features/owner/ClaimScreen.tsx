import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Store, Check } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button, Field, fieldInputClass, Thumb, Skeleton, Card } from "@/components";
import { useBusinesses, useCreateBusiness, useClaimBusiness } from "@/data/queries";
import { useSession } from "@/features/account/session";
import { BUSINESS_CATEGORIES } from "@/lib/taxonomy";

/**
 * Claim / List (B0) — free. Two paths: claim an existing unclaimed listing, or add
 * a new one (current-site parity fields). Setting ownership requires sign-in (JIT).
 */
export function ClaimScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const unclaimed = useBusinesses({ limit: 50 });
  const createBusiness = useCreateBusiness();
  const claimBusiness = useClaimBusiness();
  const [mode, setMode] = useState<"choose" | "new">("choose");

  const ownerId = () => session.user?.id ?? "owner_self";

  const becomeOwner = (businessId: string) => {
    session.setOwnerBusinessId(businessId);
    navigate("/manage", { replace: true });
  };

  const claim = (id: string) =>
    session.requireAuth(async () => {
      await claimBusiness.mutateAsync({ id, ownerId: ownerId() });
      becomeOwner(id);
    }, "account");

  const list = (unclaimed.data?.items ?? []).filter((b) => !b.claimed);

  return (
    <div className="pb-8">
      <ScreenHeader title="List your business" back />

      <div className="px-4 pt-1">
        <p className="text-sm text-muted-foreground">
          Free to list, free to keep. Your listing appears in search with equal ranking — no paid
          placement.
        </p>
      </div>

      {mode === "new" ? (
        <NewListingForm
          onCancel={() => setMode("choose")}
          submitting={createBusiness.isPending}
          onSubmit={(input) =>
            session.requireAuth(async () => {
              const created = await createBusiness.mutateAsync({ ...input, ownerId: ownerId() });
              becomeOwner(created.id);
            }, "account")
          }
        />
      ) : (
        <>
          <section className="px-4 pt-4">
            <button
              type="button"
              onClick={() => setMode("new")}
              className="flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
            >
              <Plus size={18} /> Add a new business
            </button>
          </section>

          <section className="px-4 pt-5">
            <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Store size={13} /> Or claim an existing listing
            </h2>
            {unclaimed.isLoading ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Every listing is already claimed — add a new business above.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {list.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-3">
                    <Thumb src={b.photos[0]} seed={b.name} alt={b.name} className="h-11 w-11" rounded="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-sm font-semibold leading-tight text-foreground">{b.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.category} · {b.address}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => claim(b.id)}
                      disabled={claimBusiness.isPending}
                    >
                      Claim
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

interface NewListingInput {
  name: string;
  category: string;
  address: string;
  phone?: string;
  description?: string;
}

function NewListingForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (input: NewListingInput) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(BUSINESS_CATEGORIES[0]);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const valid = name.trim() && address.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ name: name.trim(), category, address: address.trim(), phone: phone.trim() || undefined, description: description.trim() || undefined });
      }}
      className="space-y-3.5 px-4 pt-4"
    >
      <Card className="space-y-3.5 p-4">
        <Field label="Business name" required htmlFor="biz-name">
          <input id="biz-name" className={fieldInputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juniper & Sage Cafe" />
        </Field>
        <Field label="Category" htmlFor="biz-cat">
          <select id="biz-cat" className={fieldInputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Address" required htmlFor="biz-addr">
          <input id="biz-addr" className={fieldInputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, Redmond, OR" />
        </Field>
        <Field label="Phone" htmlFor="biz-phone">
          <input id="biz-phone" className={fieldInputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(541) 555-0000" inputMode="tel" />
        </Field>
        <Field label="Short description" htmlFor="biz-desc">
          <textarea id="biz-desc" className={fieldInputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes your place worth a visit?" />
        </Field>
      </Card>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" fullWidth disabled={!valid || submitting}>
          {submitting ? "Creating…" : <><Check size={16} /> Create listing</>}
        </Button>
      </div>
    </form>
  );
}
