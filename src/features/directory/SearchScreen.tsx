import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, TrendingUp, CircleDot, Sparkles, Users, Moon, ChevronRight } from "lucide-react";
import { SearchField, Chip, SectionHeader, CategoryGrid, Thumb } from "@/components";
import { useSearch } from "@/data/queries";
import { addRecentSearch, getRecentSearches } from "@/lib/recents";
import { eventTimeShort } from "@/lib/format";
import type { SearchResult } from "@/lib/types";
import { useI18n } from "@/i18n";

const TRENDING = ["Farmers market", "New cafes", "Live music", "Gluten-free"];
import type { DictKey } from "@/i18n";
interface Collection {
  labelKey: DictKey;
  descKey: DictKey;
  icon: typeof Sparkles;
  tag?: string;
  openNow?: string;
}
const COLLECTIONS: Collection[] = [
  { labelKey: "search.col.newInTown", descKey: "search.col.newInTownDesc", icon: Sparkles },
  { labelKey: "search.col.kidFriendly", descKey: "search.col.kidFriendlyDesc", icon: Users, tag: "Kid-friendly" },
  { labelKey: "search.col.openLate", descKey: "search.col.openLateDesc", icon: Moon, openNow: "1" },
];

const TAG_LABEL = {
  business: { labelKey: "search.tag.business", cls: "bg-positive/10 text-positive border-positive/25" },
  event: { labelKey: "search.tag.event", cls: "bg-accent/12 text-accent border-accent/25" },
  bulletin: { labelKey: "search.tag.community", cls: "bg-secondary text-secondary-foreground border-border" },
  news: { labelKey: "search.tag.news", cls: "bg-secondary text-secondary-foreground border-border" },
} as const;

/** Search / Explore (S3). Idle = doorways (never empty); typing = unified autocomplete. */
export function SearchScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(() => getRecentSearches());
  const typing = query.trim().length > 0;
  const ac = useSearch(query, { limit: 8 });

  const submit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecents(addRecentSearch(t));
    navigate(`/search/results?q=${encodeURIComponent(t)}`);
  };

  const openResult = (r: SearchResult) => {
    if (r.type === "business") navigate(`/b/${r.item.slug}`);
    else if (r.type === "event") navigate(`/events/${r.item.id}`);
    else if (r.type === "news") navigate(`/news/${r.item.slug}`);
    else navigate("/community");
  };

  const acMeta = useMemo(() => buildAutocomplete, []);

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-10 bg-background px-4 pt-4 pb-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(query);
          }}
        >
          <SearchField
            ref={inputRef}
            value={query}
            onChange={setQuery}
            placeholder={t("home.searchPlaceholder")}
            autoFocus
            enterKeyHint="search"
          />
        </form>
        {!typing && (
          <div className="mt-2.5 flex gap-2">
            <Chip
              onClick={() => navigate("/search/results?openNow=1")}
              leadingIcon={<CircleDot size={13} />}
            >
              {t("search.openNow")}
            </Chip>
            <Chip onClick={() => navigate("/search/results?sort=distance")}>{t("search.nearMe")}</Chip>
          </div>
        )}
      </header>

      {typing ? (
        /* ---- Unified autocomplete ---- */
        <div className="px-4">
          <button
            type="button"
            onClick={() => submit(query)}
            className="flex w-full items-center gap-3 border-b border-border py-3 text-left focus-visible:outline-none"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <CircleDot size={16} />
            </span>
            <span className="flex-1 text-sm">
              {t("search.searchFor", { q: "" }).replace("“”", "")}“<span className="font-semibold text-foreground">{query}</span>”
            </span>
            <span className="rounded-pill border border-border bg-muted px-2 py-px text-[9px] font-semibold uppercase text-muted-foreground">
              {t("common.suggestion")}
            </span>
          </button>
          {ac.data?.map((r, i) => {
            const m = acMeta(r);
            const tag = TAG_LABEL[r.type];
            return (
              <button
                key={`${r.type}-${i}`}
                type="button"
                onClick={() => openResult(r)}
                className="flex w-full items-center gap-3 border-b border-border py-3 text-left focus-visible:outline-none"
              >
                <Thumb src={m.image} seed={m.title} alt={m.title} className="h-8 w-8" rounded="rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{m.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.sub}</span>
                </span>
                <span
                  className={`shrink-0 rounded-pill border px-2 py-px text-[9px] font-semibold uppercase ${tag.cls}`}
                >
                  {t(tag.labelKey)}
                </span>
              </button>
            );
          })}
          {ac.isFetched && ac.data?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("search.noMatches")}
            </p>
          )}
        </div>
      ) : (
        /* ---- Idle browse ---- */
        <>
          <section className="px-4 py-3">
            <SectionHeader title={t("search.browseByCategory")} variant="eyebrow" />
            <CategoryGrid />
          </section>

          {recents.length > 0 && (
            <section className="px-4 py-3">
              <SectionHeader title={t("search.recent")} variant="eyebrow" />
              <ul className="-my-1 divide-y divide-border">
                {recents.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => submit(r)}
                      className="flex w-full items-center gap-2.5 py-2.5 text-left text-sm focus-visible:outline-none"
                    >
                      <Clock size={15} className="text-muted-foreground" />
                      {r}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="px-4 py-3">
            <SectionHeader title={t("search.trending")} variant="eyebrow" />
            <div className="flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <Chip key={t} onClick={() => submit(t)} leadingIcon={<TrendingUp size={12} />}>
                  {t}
                </Chip>
              ))}
            </div>
          </section>

          <section className="px-4 py-3">
            <SectionHeader title={t("search.collections")} variant="eyebrow" />
            <div className="flex flex-col gap-2.5">
              {COLLECTIONS.map((c) => {
                const params = new URLSearchParams();
                if (c.tag) params.set("tag", c.tag);
                if (c.openNow) params.set("openNow", c.openNow);
                const Icon = c.icon;
                return (
                  <button
                    key={c.labelKey}
                    type="button"
                    onClick={() => navigate(`/search/results?${params.toString()}`)}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-positive/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-positive">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-heading text-sm font-semibold text-foreground">{t(c.labelKey)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{t(c.descKey)}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** Normalize a search result for the autocomplete row. */
function buildAutocomplete(r: SearchResult): { title: string; sub: string; image?: string } {
  switch (r.type) {
    case "business":
      return {
        title: r.item.name,
        sub: [r.item.category, ...(r.item.subcategories ?? [])].slice(0, 2).join(" · "),
        image: r.item.photos[0],
      };
    case "event":
      return { title: r.item.title, sub: `${eventTimeShort(r.item.startAt)} · ${r.item.venueName ?? ""}` };
    case "news":
      return { title: r.item.title, sub: r.item.source };
    case "bulletin":
      return { title: r.item.body, sub: "Bulletin" };
  }
}
