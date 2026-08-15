/**
 * Category taxonomy + amenity facet vocabulary.
 * The browse grid (S3) uses TOP_CATEGORIES. Amenity facets (S4 filters) map
 * one-to-one to Business.amenityTags so profile + search speak one language
 * (BUILD-BRIEF §9, S5/B4 wireframe notes).
 */

export interface TopCategory {
  /** slug used in routes/queries, e.g. "food-drink" */
  slug: string;
  label: string;
  /** lucide-react icon name */
  icon: string;
  /**
   * DISPLAY vocabulary: categories that roll up here AND are offered in the owner forms.
   * Keep these human-readable — BUSINESS_CATEGORIES is derived from them and renders as a
   * <select> in Claim / Edit Listing.
   */
  includes: string[];
  /**
   * Additional STORED values that roll up here but are never offered in a form. This is
   * where the Google Sheet's own vocabulary lives.
   *
   * WHY THIS EXISTS (2026-08-14): the one-time Base44 import mapped the Sheet's slug-case
   * categories to Title Case on the way in (migration/scripts/import-base44.mjs →
   * CATEGORY_LABELS), so the table held "Food & Drink". sync-sheet does NOT do that
   * conversion — it writes the Sheet value verbatim. The first successful sync therefore
   * rewrote all 132 rows to "food-drink" etc., and every browse tile went empty because
   * `includes` only knew the Title-Case spelling: 1 of 133 businesses remained reachable.
   *
   * Both spellings are now matched, so the grid works whichever vocabulary a row carries
   * and a future Sheet edit can't silently empty it. `categoryValuesFor()` is what queries
   * must use — never `.includes` alone.
   */
  aliases?: string[];
}

export const TOP_CATEGORIES: TopCategory[] = [
  { slug: "food-drink", label: "Food & Drink", icon: "UtensilsCrossed",
    includes: ["Cafe", "Coffee", "Bakery", "Restaurant", "Bar", "Brewery", "Food & Drink", "Bars & Breweries"],
    aliases: ["food-drink", "bars-breweries"] },
  { slug: "services", label: "Services", icon: "Briefcase",
    includes: ["Services", "Professional", "Finance", "Beauty", "Professionals", "Education", "Pet Services"],
    aliases: ["services", "professionals", "education", "pet-services"] },
  { slug: "retail", label: "Retail", icon: "ShoppingBag",
    includes: ["Retail", "Grocery", "Boutique", "Shopping"],
    // "Community & Markets" is the Sheet's label for farmers/producer markets (Schoolhouse
    // Produce). A market IS retail from a resident's point of view — you go there to buy
    // things — so it rolls up here rather than sitting in the catch-all. Aliased, not
    // `includes`d, so it stays a storage spelling and never appears in the owner dropdown.
    aliases: ["retail", "shopping", "community-markets", "Community & Markets"] },
  { slug: "health", label: "Health", icon: "HeartPulse",
    includes: ["Health", "Fitness", "Wellness", "Medical", "Beauty & Wellness", "Beauty & Personal Care", "Sports & Fitness"],
    aliases: ["health", "beauty-wellness", "beauty-personal-care", "sports-fitness"] },
  { slug: "home", label: "Home", icon: "Home",
    includes: ["Home", "Hardware", "Garden", "Repair", "Home Services"],
    aliases: ["home", "home-services"] },
  { slug: "auto", label: "Auto", icon: "Car",
    includes: ["Auto", "Automotive", "Transportation"],
    aliases: ["auto", "automotive", "transportation"] },
  { slug: "outdoors", label: "Outdoors", icon: "Mountain",
    includes: ["Outdoors", "Recreation", "Sports"],
    aliases: ["outdoors", "recreation"] },
  /**
   * The catch-all. Not a category anyone is IN — the complement of the seven above, so its
   * membership is defined by `PLACED_CATEGORY_VALUES` rather than by a list of its own.
   *
   * It was labelled "More categories", which promised a second screen of tiles, and it
   * routed to unfiltered results — so a resident tapping it landed on all 133 businesses
   * captioned "133 places", with nothing marking it as a leftovers bin. Now it filters to
   * its actual members and carries their real count.
   */
  { slug: "more", label: "Everything else", icon: "Grid3x3", includes: [] },
];

/**
 * Every stored value that rolls up under a REAL tile. "more" is the complement of this set,
 * which is why it can't be expressed as an `includes`/`aliases` list: it must also catch
 * values nobody has seen yet (a new Sheet category, a typo), not just the known strays.
 */
export const PLACED_CATEGORY_VALUES: string[] = [
  ...new Set(
    TOP_CATEGORIES.filter((c) => c.slug !== "more").flatMap((c) => [
      ...c.includes,
      ...(c.aliases ?? []),
    ]),
  ),
];

/**
 * Category values that are RECOGNISED but deliberately have no tile of their own, so they
 * surface under "More categories" (which applies no category filter) and via search.
 *
 * These were already falling through to "more" before the Sheet vocabulary changed — they
 * are a pre-existing product gap, not a regression, and giving them a home is a product
 * decision rather than something to invent inside a data fix. Listing them explicitly is
 * what lets the consistency test distinguish "known and intentionally uncategorised" from
 * "nobody has ever seen this value" (a typo in the Sheet, a brand-new category).
 */
export const UNCATEGORIZED_VALUES: string[] = [
  "Entertainment", "entertainment",
  "Lodging", "lodging",
];

/** Canonical slug form of a display category — "Beauty & Personal Care" → "beauty-personal-care". */
const toSlugForm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Every display-vocabulary category the app knows, across every tile plus the catch-all. */
const DISPLAY_VALUES: string[] = [
  ...new Set([
    ...TOP_CATEGORIES.flatMap((c) => c.includes),
    // An alias that isn't already slug-form is a DISPLAY spelling the Sheet may hold —
    // "Community & Markets" alongside "community-markets". It belongs here so the label
    // survives, but NOT in `includes`, which would offer it in the owner dropdown. Without
    // this, categoryLabelFor() would fall through to its title-caser and quietly drop the
    // ampersand ("Community Markets").
    ...TOP_CATEGORIES.flatMap((c) => (c.aliases ?? []).filter((v) => v !== toSlugForm(v))),
    ...UNCATEGORIZED_VALUES.filter((v) => v !== toSlugForm(v)), // the Title-Case half of each pair
  ]),
];

/**
 * A category value as it should be SHOWN to a person.
 *
 * `businesses.category` holds whatever the Google Sheet says, and the Sheet's vocabulary is
 * slug-case ("food-drink"). That value is rendered verbatim in four places — result cards,
 * the profile header, the Claim intake list and search autocomplete — so after the first
 * Sheet sync the directory started telling visitors a business was in "food-drink" rather
 * than "Food & Drink".
 *
 * Resolution order, deliberately: an exact display value passes through untouched (so
 * owner-entered categories are never rewritten), a known slug maps to its Title-Case
 * counterpart, and anything unrecognised is title-cased as a last resort rather than shown
 * raw — a visitor should never see "artisan-crafts". Drift is caught by
 * scripts/category-vocab-test.mjs, not by leaking it into the UI.
 */
export function categoryLabelFor(value: string): string {
  if (!value) return value;
  if (DISPLAY_VALUES.includes(value)) return value;
  const slug = toSlugForm(value);
  const match = DISPLAY_VALUES.find((d) => toSlugForm(d) === slug);
  if (match) return match;
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Every stored category value that rolls up under `slug` — the list queries must filter on. */
export function categoryValuesFor(slug: string): string[] {
  const c = TOP_CATEGORIES.find((t) => t.slug === slug);
  return c ? [...c.includes, ...(c.aliases ?? [])] : [];
}

/**
 * Tile counts for a list of stored category values — the ONE implementation both data
 * sources use.
 *
 * It exists because there were two: Mock and Supabase each had their own copy, and each
 * copy carried the same `c.slug === "more" ? 0 : …` special case. Duplicated logic is how a
 * wrong answer survives — fixing one would have left the other lying. There is no special
 * case now: topCategoryFor() already routes unplaced values to "more", so the catch-all
 * tallies like every other tile.
 */
export function tallyByTile(categories: string[]): { slug: string; label: string; count: number }[] {
  const byTile = new Map<string, number>();
  for (const c of categories) {
    const slug = topCategoryFor(c);
    byTile.set(slug, (byTile.get(slug) ?? 0) + 1);
  }
  return TOP_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, count: byTile.get(c.slug) ?? 0 }));
}

/** Reverse lookup: a business category → its top category slug. */
export function topCategoryFor(category: string): string {
  const hit = TOP_CATEGORIES.find(
    (c) => c.includes.includes(category) || (c.aliases ?? []).includes(category),
  );
  return hit?.slug ?? "more";
}

/** Every category value the app knows how to place. Anything else is drift — see the test. */
export const KNOWN_CATEGORY_VALUES: string[] = [
  ...new Set([
    ...TOP_CATEGORIES.flatMap((c) => [...c.includes, ...(c.aliases ?? [])]),
    ...UNCATEGORIZED_VALUES,
  ]),
];

/**
 * Flat, de-duped list of selectable business categories (owner forms B0/B4).
 * Deliberately built from `includes` ONLY — aliases are storage spellings, and offering
 * "food-drink" next to "Food & Drink" in a dropdown would be nonsense.
 */
export const BUSINESS_CATEGORIES: string[] = [
  ...new Set(TOP_CATEGORIES.flatMap((c) => c.includes)),
].sort();

/** The amenity facets residents filter on (S4). Must match Business.amenityTags. */
export const AMENITY_FACETS: string[] = [
  "Outdoor seating",
  "Kid-friendly",
  "Wi-Fi",
  "Dog-friendly",
  "Parking",
  "Wheelchair accessible",
  "Gluten-free",
  "Vegan options",
  "Takeout",
];
