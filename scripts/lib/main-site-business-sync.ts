/**
 * Pure Redmond Compass main-site Business → Supabase planning.
 *
 * The main site's public function is the same sanitized directory feed rendered at
 * redmondcompass.com. Convert it to the already-tested sheet transform's matrix contract
 * so phone normalization, stable slugs, conservative hours parsing, explicit closed days,
 * and claimed-owner hours precedence have one implementation.
 */
import {
  buildSyncPlan,
  groupByKeySet,
  summarizePlan,
  type ExistingBusinesses,
} from "../../supabase/functions/sync-sheet/transform.ts";

export const MAIN_SITE_BUSINESS_URL =
  "https://redmondcompass.com/api/apps/6a05e41957c8ee753cb7380c/functions/listBusinessesPublic";

export const MIN_EXPECTED_BUSINESSES = 100;

export interface MainSiteBusiness {
  id?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  categories?: string[];
  description?: string;
  address?: string;
  hide_address?: boolean;
  phone?: string;
  website?: string;
  email?: string;
  hours?: string;
  status?: string;
  profile_enabled?: boolean;
}

const HEADERS = [
  "id",
  "name",
  "category",
  "published",
  "subcategories",
  "description",
  "address",
  "phone",
  "website",
  "email",
  "hours",
];

function uniqueList(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value))];
}

/** Convert the public feed to the canonical transform input. Throws before any write. */
export function mainSiteBusinessesToValues(
  payload: unknown,
  minimum = MIN_EXPECTED_BUSINESSES,
): string[][] {
  const records = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === "object" && Array.isArray((payload as { businesses?: unknown }).businesses)
      ? (payload as { businesses: MainSiteBusiness[] }).businesses
      : null);
  if (!records) throw new Error("Main-site business response did not contain a businesses array.");

  // listBusinessesPublic already applies this visibility contract. Repeating it here makes
  // the sync safe if that function later returns a broader administrative payload.
  const publicRows = (records as MainSiteBusiness[]).filter(
    (record) => record?.status === "approved" && record.profile_enabled === true,
  );
  if (publicRows.length < minimum) {
    throw new Error(
      `Main-site business feed returned ${publicRows.length} public rows; expected at least ${minimum}. Refusing a destructive partial sync.`,
    );
  }

  return [
    HEADERS,
    ...publicRows.map((record) => {
      const categories = uniqueList([
        record.subcategory,
        ...(record.categories ?? []),
      ]).filter((category) => category !== record.category);
      return [
        record.id ?? "",
        record.name ?? "",
        record.category ?? "",
        "true",
        categories.join("; "),
        record.description ?? "",
        record.hide_address ? "" : (record.address ?? ""),
        record.phone ?? "",
        record.website ?? "",
        record.email ?? "",
        record.hours ?? "",
      ];
    }),
  ];
}

export function buildMainSiteBusinessPlan(
  payload: unknown,
  supabaseUrl: string,
  nowIso: string,
  existing: ExistingBusinesses,
  minimum = MIN_EXPECTED_BUSINESSES,
) {
  const values = mainSiteBusinessesToValues(payload, minimum);
  const plan = buildSyncPlan(values, supabaseUrl, nowIso, existing);
  return { plan, summary: summarizePlan(plan, existing), groupByKeySet };
}

