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
    aliases: ["retail", "shopping"] },
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
  { slug: "more", label: "More categories", icon: "Grid3x3", includes: [] },
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
  "Community & Markets", "community-markets",
  "Lodging", "lodging",
];

/** Every stored category value that rolls up under `slug` — the list queries must filter on. */
export function categoryValuesFor(slug: string): string[] {
  const c = TOP_CATEGORIES.find((t) => t.slug === slug);
  return c ? [...c.includes, ...(c.aliases ?? [])] : [];
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

/** Interest chips for onboarding (S1) + Account (S8). Shape the personalized feed. */
export const INTERESTS: string[] = [
  "Food & Drink",
  "Coffee",
  "Outdoors",
  "Live music",
  "Family",
  "Shopping",
  "Health & fitness",
  "Home & garden",
  "Arts & culture",
  "Community events",
];

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
