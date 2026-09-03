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

export interface ExistingOwnerBusiness {
  id: string;
  name: string;
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

const normalizedName = (value: string | undefined) => (value ?? "")
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/gi, "")
  .toLowerCase();

export function ownerNameCollisions(payload: unknown, owners: ExistingOwnerBusiness[]): Array<{
  sourceId: string;
  sourceName: string;
  ownerId: string;
}> {
  const records = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === "object" && Array.isArray((payload as { businesses?: unknown }).businesses)
      ? (payload as { businesses: MainSiteBusiness[] }).businesses
      : []);
  const ownerByName = new Map(owners.map((owner) => [normalizedName(owner.name), owner]));
  return (records as MainSiteBusiness[]).flatMap((record) => {
    const owner = ownerByName.get(normalizedName(record.name));
    return owner && owner.id !== record.id
      ? [{ sourceId: record.id ?? "", sourceName: record.name ?? "", ownerId: owner.id }]
      : [];
  });
}

/** Convert the public feed to the canonical transform input. Throws before any write. */
export function mainSiteBusinessesToValues(
  payload: unknown,
  minimum = MIN_EXPECTED_BUSINESSES,
  owners: ExistingOwnerBusiness[] = [],
): string[][] {
  const records = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === "object" && Array.isArray((payload as { businesses?: unknown }).businesses)
      ? (payload as { businesses: MainSiteBusiness[] }).businesses
      : null);
  if (!records) throw new Error("Main-site business response did not contain a businesses array.");

  // listBusinessesPublic already applies this visibility contract. Repeating it here makes
  // the sync safe if that function later returns a broader administrative payload.
  const allPublicRows = (records as MainSiteBusiness[]).filter(
    (record) => record?.status === "approved" && record.profile_enabled === true,
  );
  if (allPublicRows.length < minimum) {
    throw new Error(
      `Main-site business feed returned ${allPublicRows.length} public rows; expected at least ${minimum}. Refusing a destructive partial sync.`,
    );
  }
  const collidedIds = new Set(ownerNameCollisions(allPublicRows, owners).map((row) => row.sourceId));
  const publicRows = allPublicRows.filter((record) => !collidedIds.has(record.id ?? ""));

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
  owners: ExistingOwnerBusiness[] = [],
) {
  const collisions = ownerNameCollisions(payload, owners);
  const values = mainSiteBusinessesToValues(payload, minimum, owners);
  const plan = buildSyncPlan(values, supabaseUrl, nowIso, existing);
  return { plan, summary: summarizePlan(plan, existing), groupByKeySet, ownerNameCollisions: collisions };
}
