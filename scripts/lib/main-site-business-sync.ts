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
  tags?: string[];
  description?: string;
  long_description?: string;
  address?: string;
  hide_address?: boolean;
  phone?: string;
  website?: string;
  email?: string;
  hours?: string;
  hours_location_name?: string;
  image_url?: string;
  headshot_url?: string;
  message_link?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  twitter?: string;
  pinterest?: string;
  license_number?: string;
  license_type?: string;
  specials?: string;
  specials_image_url?: string;
  additional_locations?: Array<Record<string, unknown>>;
  videos?: Array<Record<string, unknown>>;
  referral_enabled?: boolean;
  referral_promo_code?: string;
  created_date?: string;
  updated_date?: string;
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

function completeness(record: MainSiteBusiness): number {
  return [record.hours, record.phone, record.website, record.email, record.address, record.description]
    .filter((value) => !!value?.trim()).length;
}

/** Pick one public row per normalized business name, favoring complete and then newer data. */
export function dedupeSourceBusinesses(records: MainSiteBusiness[]): {
  rows: MainSiteBusiness[];
  collisions: Array<{ name: string; keptId: string; suppressedIds: string[] }>;
} {
  const groups = new Map<string, MainSiteBusiness[]>();
  for (const record of records) {
    const key = normalizedName(record.name) || `id:${record.id ?? ""}`;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  const rows: MainSiteBusiness[] = [];
  const collisions: Array<{ name: string; keptId: string; suppressedIds: string[] }> = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) =>
      completeness(b) - completeness(a)
      || String(b.updated_date ?? "").localeCompare(String(a.updated_date ?? ""))
      || String(a.id ?? "").localeCompare(String(b.id ?? "")),
    );
    const winner = ordered[0];
    rows.push(winner);
    if (ordered.length > 1) {
      collisions.push({
        name: winner.name ?? "",
        keptId: winner.id ?? "",
        suppressedIds: ordered.slice(1).map((record) => record.id ?? ""),
      });
    }
  }
  return { rows, collisions };
}

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
  const deduped = dedupeSourceBusinesses(allPublicRows).rows;
  const collidedIds = new Set(ownerNameCollisions(deduped, owners).map((row) => row.sourceId));
  const publicRows = deduped.filter((record) => !collidedIds.has(record.id ?? ""));

  return [
    HEADERS,
    ...publicRows.map((record) => {
      const categories = uniqueList([
        record.subcategory,
        ...(record.tags ?? []),
      ]);
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
  const rawRecords = Array.isArray(payload)
    ? payload as MainSiteBusiness[]
    : ((payload as { businesses?: MainSiteBusiness[] } | null)?.businesses ?? []);
  const visibleRecords = rawRecords.filter((record) => record?.status === "approved" && record.profile_enabled === true);
  const sourceNameCollisions = dedupeSourceBusinesses(visibleRecords).collisions;
  const dedupedPayload = dedupeSourceBusinesses(visibleRecords).rows;
  const collisions = ownerNameCollisions(dedupedPayload, owners);
  const values = mainSiteBusinessesToValues(payload, minimum, owners);
  const basePlan = buildSyncPlan(values, supabaseUrl, nowIso, existing);
  const collisionIds = new Set(collisions.map((row) => row.sourceId));
  const sourceById = new Map(
    dedupedPayload
      .filter((record) => record.id && !collisionIds.has(record.id))
      .map((record) => [record.id!, record]),
  );
  const nullable = (value: string | undefined) => value?.trim() || null;
  const validIso = (value: string | undefined) => {
    if (!value || Number.isNaN(Date.parse(value))) return null;
    return new Date(value).toISOString();
  };
  const plan = {
    ...basePlan,
    upserts: basePlan.upserts.map((row) => {
      const source = sourceById.get(row.id);
      if (!source) return row;
      const socials = Object.fromEntries(
        ["facebook", "instagram", "tiktok", "youtube", "linkedin", "twitter", "pinterest"]
          .map((key) => [key, nullable(source[key as keyof MainSiteBusiness] as string | undefined)])
          .filter(([, value]) => value),
      );
      const extraCategories = uniqueList(source.categories ?? [])
        .filter((category) => category !== source.category);
      const image = nullable(source.image_url);
      return {
        ...row,
        long_description: nullable(source.long_description),
        message_link: nullable(source.message_link),
        socials,
        license_number: nullable(source.license_number),
        license_type: nullable(source.license_type),
        specials: nullable(source.specials),
        specials_image_url: nullable(source.specials_image_url),
        additional_locations: source.additional_locations?.length ? source.additional_locations : null,
        extra_categories: extraCategories,
        hide_address: !!source.hide_address,
        hours_location_name: nullable(source.hours_location_name),
        videos: source.videos?.length ? source.videos : null,
        headshot_url: nullable(source.headshot_url),
        referral_enabled: !!source.referral_enabled,
        referral_promo_code: nullable(source.referral_promo_code),
        source_updated_at: validIso(source.updated_date),
        ...(validIso(source.created_date) && !existing.slugById[row.id]
          ? { created_at: validIso(source.created_date) }
          : {}),
        // A public main-site identity image is canonical for new/refreshed rows. When the
        // source is blank, omit photos rather than destroying already-recovered gallery art.
        ...(image ? { photos: [image] } : {}),
      };
    }),
  };
  return {
    plan,
    summary: summarizePlan(plan, existing),
    groupByKeySet,
    ownerNameCollisions: collisions,
    sourceNameCollisions,
  };
}
