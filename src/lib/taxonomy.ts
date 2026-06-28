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
  /** business categories that roll up under this top category */
  includes: string[];
}

export const TOP_CATEGORIES: TopCategory[] = [
  { slug: "food-drink", label: "Food & Drink", icon: "UtensilsCrossed", includes: ["Cafe", "Coffee", "Bakery", "Restaurant", "Bar", "Brewery"] },
  { slug: "services", label: "Services", icon: "Briefcase", includes: ["Services", "Professional", "Finance", "Beauty"] },
  { slug: "retail", label: "Retail", icon: "ShoppingBag", includes: ["Retail", "Grocery", "Boutique"] },
  { slug: "health", label: "Health", icon: "HeartPulse", includes: ["Health", "Fitness", "Wellness", "Medical"] },
  { slug: "home", label: "Home", icon: "Home", includes: ["Home", "Hardware", "Garden", "Repair"] },
  { slug: "auto", label: "Auto", icon: "Car", includes: ["Auto", "Automotive"] },
  { slug: "outdoors", label: "Outdoors", icon: "Mountain", includes: ["Outdoors", "Recreation", "Sports"] },
  { slug: "more", label: "More categories", icon: "Grid3x3", includes: [] },
];

/** Reverse lookup: a business category → its top category slug. */
export function topCategoryFor(category: string): string {
  const hit = TOP_CATEGORIES.find((c) => c.includes.includes(category));
  return hit?.slug ?? "more";
}

/** Flat, de-duped list of selectable business categories (owner forms B0/B4). */
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
