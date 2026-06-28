import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpDown, SlidersHorizontal, Map as MapIcon, MapPin } from "lucide-react";
import {
  SearchField,
  Chip,
  Toggle,
  ResultCard,
  EventCard,
  FeedItem,
  EmptyState,
  Skeleton,
} from "@/components";
import { useBusinesses, useEvents, useSearch } from "@/data/queries";
import type { BusinessSort } from "@/data/DataSource";
import { AMENITY_FACETS, TOP_CATEGORIES } from "@/lib/taxonomy";
import { relativeTime } from "@/lib/format";
import { useSession } from "@/features/account/session";

type Tab = "all" | "businesses" | "events" | "community";
const SORTS: { value: BusinessSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "distance", label: "Distance" },
  { value: "openNow", label: "Open now" },
  { value: "name", label: "Name" },
];

/** Results & filters (S4). List view + filters; map is deferred (seam present). */
export function ResultsScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [view, setView] = useState<"list" | "map">("list");
  const [panel, setPanel] = useState<"none" | "sort" | "filters">("none");

  const q = params.get("q") ?? "";
  const cat = params.get("cat") ?? undefined;
  const openNow = params.get("openNow") === "1";
  const sort = (params.get("sort") as BusinessSort) ?? "relevance";
  const tags = useMemo(() => (params.get("tags") ? params.get("tags")!.split(",") : []), [params]);
  const maxmi = params.get("maxmi") ? Number(params.get("maxmi")) : undefined;

  const businesses = useBusinesses({
    text: q || undefined,
    categorySlug: cat,
    openNow: openNow || undefined,
    amenityTags: tags.length ? tags : undefined,
    sort,
    maxDistanceMi: maxmi,
    origin: session.location ?? undefined,
  });
  const events = useEvents({ text: q || undefined });
  const community = useSearch(q, { types: ["news", "bulletin"], limit: 12 });

  const catLabel = TOP_CATEGORIES.find((c) => c.slug === cat)?.label;
  const heading = q || catLabel || "All Redmond";
  const count = businesses.data?.total ?? 0;

  const patch = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const toggleTag = (t: string) => {
    const set = new Set(tags);
    set.has(t) ? set.delete(t) : set.add(t);
    patch({ tags: [...set].join(",") || null });
  };

  const activeFilters = [
    openNow ? { label: "Open now", clear: () => patch({ openNow: null }) } : null,
    maxmi ? { label: `< ${maxmi} mi`, clear: () => patch({ maxmi: null }) } : null,
    ...tags.map((t) => ({ label: t, clear: () => toggleTag(t) })),
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="pb-4">
      {/* Sticky results header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pt-3 pb-2.5 shadow-sticky backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchField
              value=""
              onChange={() => {}}
              readOnlyButton
              onActivate={() => navigate("/search")}
              placeholder={heading}
            />
          </div>
          <Toggle
            ariaLabel="Results view"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "List" },
              { value: "map", label: "Map" },
            ]}
          />
        </div>

        {view === "list" && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-heading font-semibold text-foreground">{count}</span>{" "}
                {count === 1 ? "place" : "places"}
                {openNow ? " · Open now" : ""}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPanel((p) => (p === "sort" ? "none" : "sort"))}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-medium"
                >
                  <ArrowUpDown size={13} /> Sort
                </button>
                <button
                  type="button"
                  onClick={() => setPanel((p) => (p === "filters" ? "none" : "filters"))}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-xs font-medium"
                >
                  <SlidersHorizontal size={13} /> Filters
                </button>
              </div>
            </div>

            {activeFilters.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {activeFilters.map((f) => (
                  <Chip key={f.label} active onRemove={f.clear}>
                    {f.label}
                  </Chip>
                ))}
              </div>
            )}

            {/* Result tabs */}
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
              {(["all", "businesses", "events", "community"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    "shrink-0 rounded-pill px-3 py-1.5 text-xs font-medium capitalize transition " +
                    (tab === t ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}
      </header>

      {/* Sort panel */}
      {view === "list" && panel === "sort" && (
        <div className="border-b border-border bg-card px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Sort by</p>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <Chip
                key={s.value}
                active={sort === s.value}
                onClick={() => {
                  patch({ sort: s.value === "relevance" ? null : s.value });
                  setPanel("none");
                }}
              >
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Filters panel */}
      {view === "list" && panel === "filters" && (
        <div className="space-y-3 border-b border-border bg-card px-4 py-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Availability</p>
            <Chip active={openNow} onClick={() => patch({ openNow: openNow ? null : "1" })}>
              Open now
            </Chip>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Distance</p>
            <div className="flex flex-wrap gap-2">
              {[2, 5, 10].map((mi) => (
                <Chip key={mi} active={maxmi === mi} onClick={() => patch({ maxmi: maxmi === mi ? null : String(mi) })}>
                  {`< ${mi} mi`}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITY_FACETS.map((t) => (
                <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      {view === "map" ? (
        <MapPlaceholder onBack={() => setView("list")} />
      ) : (
        <div className="px-4">
          {tab === "all" || tab === "businesses" ? (
            businesses.isLoading ? (
              <ResultsSkeleton />
            ) : count === 0 ? (
              <NoResults
                query={heading}
                hasFilters={activeFilters.length > 0}
                onClearFilters={() => patch({ openNow: null, maxmi: null, tags: null })}
              />
            ) : (
              <ul className="divide-y divide-border">
                {businesses.data?.items.map((b) => (
                  <li key={b.id}>
                    <ResultCard
                      business={b}
                      origin={session.location ?? undefined}
                      saved={session.isSaved(b.id)}
                      onSave={() => session.toggleSaveBusiness(b.id)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : tab === "events" ? (
            <div className="divide-y divide-border">
              {events.data?.length ? (
                events.data.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    origin={session.location ?? undefined}
                    saved={session.isSavedEvent(e.id)}
                    onSave={() => session.toggleSaveEvent(e.id)}
                    addToCalendar
                  />
                ))
              ) : (
                <EmptyState
                  icon={<MapPin size={20} />}
                  title="No matching events"
                  message="Try the Events tab for everything happening in Redmond."
                  action={{ label: "Browse events", href: "/events" }}
                />
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {community.data?.length ? (
                community.data.map((r, i) => {
                  if (r.type === "news")
                    return (
                      <FeedItem
                        key={i}
                        type="news"
                        title={r.item.title}
                        sourceLabel={r.item.source}
                        time={relativeTime(r.item.publishedAt)}
                        href={`/news/${r.item.slug}`}
                      />
                    );
                  if (r.type === "bulletin")
                    return (
                      <FeedItem
                        key={i}
                        type="bulletin"
                        title={r.item.body}
                        sourceLabel="Local business"
                        time={relativeTime(r.item.createdAt)}
                      />
                    );
                  return null;
                })
              ) : (
                <EmptyState
                  icon={<MapPin size={20} />}
                  title="No community posts"
                  message="See the latest news and bulletins in Community."
                  action={{ label: "Open Community", href: "/community" }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 py-3">
          <Skeleton className="h-[58px] w-[58px] rounded-lg" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NoResults({
  query,
  hasFilters,
  onClearFilters,
}: {
  query: string;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="py-8 text-center">
      <h3 className="font-heading text-md font-semibold text-foreground">No matches for “{query}”</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">Here are a few ways forward:</p>
      <div className="mx-auto mt-4 flex max-w-xs flex-col gap-2">
        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="min-h-tap rounded-lg border border-border bg-card px-4 text-sm font-medium"
          >
            Clear all filters
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate("/search")}
          className="min-h-tap rounded-lg border border-border bg-card px-4 text-sm font-medium"
        >
          Try a different search
        </button>
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Try a category
      </p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-2">
        {TOP_CATEGORIES.filter((c) => c.slug !== "more")
          .slice(0, 4)
          .map((c) => (
            <Chip key={c.slug} onClick={() => navigate(`/search/results?cat=${c.slug}`)}>
              {c.label}
            </Chip>
          ))}
      </div>
    </div>
  );
}

/** Map view is deferred (BUILD-BRIEF §3) — this seam keeps the toggle honest. */
function MapPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <EmptyState
      icon={<MapIcon size={22} />}
      title="Map view is coming soon"
      message="The same results and filters will appear on a map. For now, browse the list."
      action={{ label: "Back to list", onClick: onBack }}
    />
  );
}
