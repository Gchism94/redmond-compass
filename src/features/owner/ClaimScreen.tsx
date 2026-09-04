import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus, Store, Check, ExternalLink } from "lucide-react";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Button, Field, fieldInputClass, Thumb, Skeleton, Card, SearchField, EmptyState, ErrorState } from "@/components";
import { useBusinesses, useCreateBusiness, useClaimBusiness } from "@/data/queries";
import { useSession } from "@/features/account/session";
import { BUSINESS_CATEGORIES, categoryLabelFor } from "@/lib/taxonomy";
import { appOnly, OWNER_LINKS } from "@/lib/siteMode";
import { MutationError } from "./MutationError";
import { useI18n } from "@/i18n";

/**
 * Claim / List (B0) — free. Two paths: claim an existing unclaimed listing, or add
 * a new one (current-site parity fields). Setting ownership requires sign-in (JIT).
 */
/** How many unclaimed listings to reveal at a time (grows on "show more"). */
const PAGE = 25;

export function ClaimScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const session = useSession();
  const [mode, setMode] = useState<"choose" | "new">("choose");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [actionError, setActionError] = useState<unknown>(null);

  // An owner has to be able to find THEIR listing, whatever its rank. The old query was
  // `useBusinesses({ limit: 50 })` filtered to unclaimed client-side, with no search — so
  // with 130 unclaimed listings, ~80 owners had no route to their own business at all.
  //
  // Three changes remove the ceiling rather than raise it: search by name/address, an
  // alphabetical order the owner can actually predict (relevance ranking is meaningless
  // when you're looking for one specific name), and a reveal count that grows on demand.
  // `claimed: false` is a SERVER-side filter, so `total` counts unclaimed listings only and
  // the "show more" maths can't drift the way client-side filtering of a page would.
  const unclaimed = useBusinesses({
    text: query.trim() || undefined,
    claimed: false,
    sort: "name",
    limit: shown,
  });
  const createBusiness = useCreateBusiness();
  const claimBusiness = useClaimBusiness();

  // A new search starts from the first page again.
  useEffect(() => setShown(PAGE), [query]);

  const becomeOwner = (businessId: string) => {
    session.setOwnerBusinessId(businessId);
    navigate("/manage", { replace: true });
  };

  // `requireAuth` DISCARDS the promise this callback returns (the AuthSheet calls it as
  // `pending?.()`), so a rejection here can never be caught by the caller — it has to be
  // caught inside the callback or it becomes an unhandled rejection and the owner sees the
  // Claim button simply do nothing.
  const claim = (id: string) =>
    session.requireAuth(async () => {
      setActionError(null);
      try {
        await claimBusiness.mutateAsync(id);
        becomeOwner(id);
      } catch (e) {
        setActionError(e);
      }
    }, "account");

  const createListing = (input: NewListingInput) =>
    session.requireAuth(async () => {
      setActionError(null);
      try {
        const created = await createBusiness.mutateAsync(input);
        becomeOwner(created.id);
      } catch (e) {
        setActionError(e);
      }
    }, "account");

  const list = unclaimed.data?.items ?? [];
  const total = unclaimed.data?.total ?? 0;
  const hasMore = list.length < total;

  return (
    <div className="pb-8">
      <ScreenHeader title={t("owner.claimTitle")} back />

      <div className="px-4 pt-1">
        <p className="text-sm text-muted-foreground">
          {t("owner.claimFree")}
        </p>
        {appOnly ? (
          <a
            href={OWNER_LINKS.business}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1.5 inline-flex min-h-tap items-center gap-1 text-sm font-medium text-positive"
          >
            {t("guides.forOwners")} <ExternalLink size={13} />
          </a>
        ) : (
          <Link to="/for-business-owners" className="mt-1.5 inline-flex min-h-tap items-center gap-1 text-sm font-medium text-positive">
            {t("guides.forOwners")} <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {mode === "new" && !appOnly ? (
        <NewListingForm
          onCancel={() => setMode("choose")}
          submitting={createBusiness.isPending}
          error={actionError}
          onSubmit={createListing}
        />
      ) : (
        <>
          <section className="px-4 pt-4">
            {appOnly ? (
              <a
                href={OWNER_LINKS.business}
                target="_blank"
                rel="noreferrer noopener"
                className="flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
              >
                <Plus size={18} /> {t("owner.addNewMainSite")} <ExternalLink size={15} />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setMode("new")}
                className="flex min-h-tap w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground"
              >
                <Plus size={18} /> {t("owner.addNew")}
              </button>
            )}
            {appOnly && (
              <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
                {t("owner.mainSiteFirstHint")}
              </p>
            )}
          </section>

          <section className="px-4 pt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Store size={13} /> {t("owner.orClaim")}
            </h2>

            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={t("owner.findYours")}
              aria-label={t("owner.findYours")}
            />

            <div className="pt-3 empty:hidden">
              <MutationError error={actionError} />
            </div>

            {unclaimed.isError ? (
              <ErrorState title={t("error.loadBusinesses")} onRetry={() => unclaimed.refetch()} />
            ) : unclaimed.isLoading ? (
              <div className="space-y-3 pt-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : list.length === 0 ? (
              query.trim() ? (
                // A no-match search is NOT "everything is claimed" — say which it is, and
                // give the owner the forward path (add it) instead of a dead end.
                <EmptyState
                  icon={<Store size={20} />}
                  title={t("owner.noMatch")}
                  message={t("owner.noMatchMsg")}
                  action={appOnly
                    ? { label: t("owner.addNewMainSite"), onClick: () => window.open(OWNER_LINKS.business, "_blank", "noopener,noreferrer") }
                    : { label: t("owner.addNew"), onClick: () => setMode("new") }}
                />
              ) : (
                <p className="py-4 text-sm text-muted-foreground">{t("owner.allClaimed")}</p>
              )
            ) : (
              <>
                <p className="pt-3 text-xs text-muted-foreground">
                  {t("owner.showingCount", { shown: String(list.length), total: String(total) })}
                </p>
                <ul className="divide-y divide-border">
                  {list.map((b) => (
                    <li key={b.id} className="flex items-center gap-3 py-3">
                      <Thumb src={b.photos[0]} seed={b.name} alt={b.name} className="h-11 w-11" rounded="rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-sm font-semibold leading-tight text-foreground">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{categoryLabelFor(b.category)} · {b.address}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-tap"
                        onClick={() => claim(b.id)}
                        disabled={claimBusiness.isPending}
                      >
                        {t("owner.claim")}
                      </Button>
                    </li>
                  ))}
                </ul>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE)}
                    className="mt-2 flex min-h-tap w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {t("owner.showMore")}
                  </button>
                )}
              </>
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
  error,
}: {
  onSubmit: (input: NewListingInput) => void;
  onCancel: () => void;
  submitting: boolean;
  /** Failure from the create mutation — rendered by the button so the form stays filled. */
  error?: unknown;
}) {
  const { t } = useI18n();
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
        <Field label={t("owner.bizName")} required htmlFor="biz-name">
          <input id="biz-name" className={fieldInputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Juniper & Sage Cafe" />
        </Field>
        <Field label={t("owner.category")} htmlFor="biz-cat">
          <select id="biz-cat" className={fieldInputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={t("owner.address")} required htmlFor="biz-addr">
          <input id="biz-addr" className={fieldInputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, Redmond, OR" />
        </Field>
        <Field label={t("owner.phone")} htmlFor="biz-phone">
          <input id="biz-phone" className={fieldInputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(541) 555-0000" inputMode="tel" />
        </Field>
        <Field label={t("owner.shortDesc")} htmlFor="biz-desc">
          <textarea id="biz-desc" className={fieldInputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("owner.descPlaceholder")} />
        </Field>
      </Card>
      <MutationError error={error} />

      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" variant="primary" fullWidth disabled={!valid || submitting}>
          {submitting ? t("owner.creating") : <><Check size={16} /> {t("owner.createListing")}</>}
        </Button>
      </div>
    </form>
  );
}
