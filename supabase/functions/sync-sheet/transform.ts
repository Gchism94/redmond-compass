// Pure transform logic for the sync-sheet edge function. NO Deno APIs and NO app
// imports live here, so the exact same code runs in the edge function (Deno) AND
// in scripts/sync-sheet-test.mjs (Node, via esbuild) — the sheet→row mapping is
// unit-tested without ever touching Google.
//
// The Google Sheet is the source of truth for directory data. We parse by header
// NAME (not column position), so editors can reorder columns freely; only a
// missing REQUIRED header or an empty sheet aborts the run (data left intact).

export const REQUIRED_HEADERS = ["id", "name", "category", "published"] as const;
export const KNOWN_HEADERS = [
  "id", "name", "category", "subcategories", "description", "address",
  "phone", "website", "email", "hours", "image", "published", "notes",
] as const;

// Header aliases → canonical field name. Every column already matches case-insensitively
// (Name→name, Category→category, …), so the Base44 export's Title-Case headers map with no
// edit — except `Business ID`, whose word break stops it resolving to `id`. Aliasing it
// keeps the contract consistent (a header the parser already understands, just spelled the
// export's way). Keys are normalized (trim+lowercase); `id` spelled literally still works.
export const HEADER_ALIASES: Record<string, string> = {
  "business id": "id",
};

export interface SheetBusinessRow {
  id: string;
  name: string;
  /** REQUIRED: `businesses.slug` is `text not null unique` with NO default — a payload
   *  without it fails the INSERT half of the upsert and aborts the whole batch. */
  slug: string;
  category: string;
  subcategories?: string[];
  description?: string;
  address?: string;
  phone?: string;
  website?: string;
  email?: string;
  hours_text?: string;
  photos?: string[];
  published: boolean;
  synced_at: string;
}

export interface SyncPlan {
  ok: boolean;
  abortReason?: string; // set ⇒ run-level failure; caller must NOT write anything
  headerWarnings: string[];
  upserts: SheetBusinessRow[];
  sheetIds: string[]; // every id present in the sheet (published or not)
  /** ids whose `published` cell was EMPTY (vs. an explicit "no"/"FALSE"). Both parse to
   *  false — fail-closed — but only the blank ones are plausibly an un-ticked checkbox
   *  rather than a deliberate hide, so a dry run reports them separately. */
  publishedBlankIds: string[];
  skipped: { row: number; reason: string }[];
  warnings: { row: number; reason: string }[];
}

/**
 * What the DB already holds, so the plan can keep slugs stable and collision-free and
 * report what a run would change. The caller (index.ts) reads this once, service-role.
 */
export interface ExistingBusinesses {
  /** businesses.id → its CURRENT slug. Rows here keep that slug forever (see below). */
  slugById: Record<string, string>;
  /** businesses.id → its current `published` value. */
  publishedById?: Record<string, boolean>;
  /** businesses.id → whether `synced_at` is set (i.e. the sync has touched it before). */
  syncedById?: Record<string, boolean>;
}

/** Read-only preview of what a run would do — the shape `?dry=1` returns. */
export interface PlanSummary {
  sheetRows: number;
  upserts: number;
  /** ids in the Sheet that have no row in `businesses` yet → INSERTs. */
  newIds: { count: number; sample: string[] };
  existingIds: number;
  /** live rows the Sheet would HIDE (published true → false). The number that matters. */
  wouldUnpublish: {
    total: number;
    blankCell: { count: number; sample: { id: string; name: string }[] };
    explicitFalse: { count: number; sample: { id: string; name: string }[] };
  };
  /** currently-hidden rows the Sheet would bring back (published false → true). */
  wouldPublish: number;
  /** previously-synced rows absent from the Sheet → soft-unpublished by the run. */
  wouldSoftUnpublish: { count: number; sample: string[] };
  skipped: number;
  warnings: number;
}

/** The set of columns a row supplies, as a stable signature. */
export function keySetSignature(row: Record<string, unknown>): string {
  return Object.keys(row).sort().join("|");
}

/**
 * Split rows into groups that all supply EXACTLY the same columns.
 *
 * PostgREST builds one INSERT per request using the UNION of keys across every row in the
 * batch, and injects NULL for any row that didn't supply one of them. That defeats two
 * things at once:
 *
 *  1. NOT NULL. `address`/`description` are `not null default ''` and `subcategories`/
 *     `photos` are `not null default '{}'`. A DEFAULT only applies to an OMITTED column —
 *     an explicit NULL violates the constraint. Because some Sheet rows have an address
 *     and others don't, `address` entered the column list and the addressless rows were
 *     sent NULL: "null value in column \"address\" … violates not-null constraint",
 *     which is what run #15 died on.
 *  2. The preserve-on-omission contract this transform deliberately relies on ("only set
 *     photos when the sheet names an image — otherwise leave any existing photos
 *     untouched"). ON CONFLICT DO UPDATE assigns every column in the union, so a row that
 *     omitted `photos` would have had its existing photos overwritten anyway.
 *
 * Grouping by key-set keeps an omitted column out of the statement entirely, so both hold.
 *
 * NOTE: `defaultToNull: false` is NOT the fix. It stops the crash by substituting column
 * defaults, then silently blanks exactly the editorial content the contract above protects
 * — verified: an existing address "2 Second St" became "" and photos ["b-editorial.jpg"]
 * became []. Grouping preserved both untouched.
 */
export function groupByKeySet<T extends Record<string, unknown>>(rows: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const sig = keySetSignature(row);
    const g = groups.get(sig);
    if (g) g.push(row);
    else groups.set(sig, [row]);
  }
  return [...groups.values()];
}

/**
 * Diff a plan against current DB state. Pure — no network — so the dry-run numbers are
 * unit-tested rather than only ever observed in production.
 */
export function summarizePlan(plan: SyncPlan, existing: ExistingBusinesses): PlanSummary {
  const publishedById = existing.publishedById ?? {};
  const syncedById = existing.syncedById ?? {};
  const known = (id: string) => Object.prototype.hasOwnProperty.call(existing.slugById, id)
    || Object.prototype.hasOwnProperty.call(publishedById, id);
  const blank = new Set(plan.publishedBlankIds);

  const newIds = plan.upserts.filter((u) => !known(u.id)).map((u) => u.id);
  const goingDark = plan.upserts.filter((u) => !u.published && publishedById[u.id] === true);
  const comingBack = plan.upserts.filter((u) => u.published && publishedById[u.id] === false);

  const sheetIdSet = new Set(plan.sheetIds);
  const softUnpublish = Object.keys(publishedById).filter(
    (id) => syncedById[id] && publishedById[id] && !sheetIdSet.has(id),
  );

  const brief = (rows: SheetBusinessRow[]) => rows.slice(0, 10).map((u) => ({ id: u.id, name: u.name }));
  const dark = { blank: goingDark.filter((u) => blank.has(u.id)), explicit: goingDark.filter((u) => !blank.has(u.id)) };

  return {
    sheetRows: plan.sheetIds.length,
    upserts: plan.upserts.length,
    newIds: { count: newIds.length, sample: newIds.slice(0, 10) },
    existingIds: plan.upserts.length - newIds.length,
    wouldUnpublish: {
      total: goingDark.length,
      blankCell: { count: dark.blank.length, sample: brief(dark.blank) },
      explicitFalse: { count: dark.explicit.length, sample: brief(dark.explicit) },
    },
    wouldPublish: comingBack.length,
    wouldSoftUnpublish: { count: softUnpublish.length, sample: softUnpublish.slice(0, 10) },
    skipped: plan.skipped.length,
    warnings: plan.warnings.length,
  };
}

const norm = (h: string) => h.trim().toLowerCase();
// Canonical header key: lowercase, trim, and collapse internal whitespace, then fold known
// aliases. Case- and whitespace-insensitive, so "Business ID" / "business  id" → "id".
const canon = (h: string): string => {
  const n = norm(h).replace(/\s+/g, " ");
  return HEADER_ALIASES[n] ?? n;
};

export function parseBool(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1" || s === "x";
}

export function splitList(v: string | undefined): string[] {
  return (v ?? "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Best-effort US E.164. Returns { phone, ok }; ok=false ⇒ kept as-is and logged
// (a row is never dropped over an unparseable phone).
export function normalizePhone(v: string | undefined): { phone: string | undefined; ok: boolean } {
  const raw = (v ?? "").trim();
  if (!raw) return { phone: undefined, ok: true };
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return { phone: `+1${digits}`, ok: true };
  if (digits.length === 11 && digits.startsWith("1")) return { phone: `+${digits}`, ok: true };
  if (raw.startsWith("+") && digits.length >= 8) return { phone: `+${digits}`, ok: true };
  return { phone: raw, ok: false };
}

export function storageUrl(supabaseUrl: string, filename: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/business-media/${encodeURIComponent(filename.trim())}`;
}

const SLUG_MAX = 60;

/**
 * Deterministic URL slug from a business name — the convention the existing 133 imported
 * rows already follow (lowercase, every run of non-alphanumerics → one hyphen, trimmed):
 * "General Duffy's Waterhole" → "general-duffy-s-waterhole".
 *
 * Diacritics are folded first (Café → cafe) so an accented edit in the Sheet yields a
 * clean ASCII URL instead of dropping the letter. A name that slugifies to nothing (all
 * punctuation, or a non-Latin script) falls back to the row's id, which is always present
 * and unique — so this NEVER returns an empty string, which the not-null column would
 * reject and which would make a useless /b/ URL.
 */
export function slugify(name: string, idFallback = ""): string {
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = fold(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, ""); // the slice can leave a trailing hyphen
  if (base) return base;
  const fromId = fold(idFallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return fromId ? `listing-${fromId}`.slice(0, SLUG_MAX) : "listing";
}

/**
 * First free slug at or after `base`, appending -2, -3, … . `taken` is mutated so the
 * caller's running set stays authoritative across rows in the same batch.
 */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  // Trim the base so base + suffix still fits SLUG_MAX rather than silently growing.
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}

/**
 * Turn the raw Sheet values matrix (row 0 = headers) into a write plan.
 * @param values  the Google Sheets `values` array (array of string rows)
 * @param supabaseUrl  for building public image URLs from bucket filenames
 * @param nowIso  synced_at stamp (passed in — Deno/Node both supply it)
 * @param existing  current id→slug map from `businesses` (see slug policy below). Omitted
 *                  ⇒ every row gets a freshly generated slug; index.ts always passes it.
 */
export function buildSyncPlan(
  values: string[][],
  supabaseUrl: string,
  nowIso: string,
  existing: ExistingBusinesses = { slugById: {} },
): SyncPlan {
  const plan: SyncPlan = {
    ok: true, headerWarnings: [], upserts: [], sheetIds: [], publishedBlankIds: [], skipped: [], warnings: [],
  };

  if (!values || values.length === 0) {
    return { ...plan, ok: false, abortReason: "Sheet is empty (no header row) — aborting to protect existing data." };
  }
  const headers = values[0].map(canon); // canonical names (aliases folded: 'Business ID' → id)
  const rawHeaders = values[0].map((h) => (h ?? "").trim()); // untouched text, for diagnostics
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    // Self-diagnosing abort: name the missing columns AND echo exactly what the header
    // row contained, so the cause (a rename, or a too-narrow read range that truncated
    // columns) is visible from the message alone — no inference from the missing list.
    return {
      ...plan,
      ok: false,
      abortReason:
        `Header row missing required column(s): ${missing.join(", ")}. ` +
        `Saw ${rawHeaders.length} column(s): [${rawHeaders.join(", ")}]. ` +
        `Schema drift or a too-narrow read range — aborting (existing data left intact).`,
    };
  }
  const unknown = headers.filter((h) => h && !KNOWN_HEADERS.includes(h as (typeof KNOWN_HEADERS)[number]));
  if (unknown.length) plan.headerWarnings.push(`Ignoring unknown column(s): ${unknown.join(", ")}`);

  const dataRows = values.slice(1);
  if (dataRows.length === 0) {
    return { ...plan, ok: false, abortReason: "Sheet has a header but no data rows — aborting to protect existing data." };
  }

  const col = (h: string) => headers.indexOf(h);
  const get = (row: string[], h: string) => {
    const i = col(h);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  // ── Slug policy ──────────────────────────────────────────────────────────────────────
  // `businesses.slug` is `text not null unique` with NO default, so every upsert payload
  // MUST carry one (omitting it was the bug that made every run 500 on the first INSERT).
  //
  //  • A row whose id is ALREADY in the table keeps its CURRENT slug, untouched. Slugs are
  //    public URLs (/b/:slug) that people bookmark, share and save — regenerating them from
  //    the name on every sync would silently 404 every link the moment an owner fixes a typo
  //    in the Sheet. Stable-by-id beats always-matches-the-name for a directory.
  //  • A NEW id gets slugify(name), de-duplicated against every slug already in the table
  //    AND every slug assigned earlier in this same batch (two new "Redmond Barbershop"
  //    rows → redmond-barbershop and redmond-barbershop-2).
  const taken = new Set<string>(Object.values(existing.slugById));

  const seen = new Set<string>();
  dataRows.forEach((row, i) => {
    const n = i + 2; // 1-based sheet row (header is row 1)
    const id = get(row, "id");
    const name = get(row, "name");
    if (!id) return; // blank trailing rows — silently ignore
    if (!name) { plan.skipped.push({ row: n, reason: `id "${id}" has no name` }); return; }
    if (seen.has(id)) { plan.skipped.push({ row: n, reason: `duplicate id "${id}"` }); return; }
    seen.add(id);
    plan.sheetIds.push(id);

    const { phone, ok: phoneOk } = normalizePhone(get(row, "phone"));
    if (!phoneOk) plan.warnings.push({ row: n, reason: `phone "${get(row, "phone")}" not E.164-normalizable (kept as-is)` });

    const image = get(row, "image");
    // The upsert payload is EXACTLY the fields below — never a ranking/boost field. Base44's
    // `Featured` column is intentionally unmapped (absent from KNOWN_HEADERS), so it is dropped
    // as an unknown column and can never reach the DB. Equal ranking is non-negotiable: it is
    // enforced structurally (`businesses` has no featured/boost/rank/priority column at all) and
    // at the query layer (no sort in SupabaseDataSource.sortBusinesses applies a paid boost).
    // Adding any featured/rank/priority field to this payload would silently break that guarantee.
    // Track a BLANK published cell separately from an explicit "no": both are false
    // (fail-closed), but only a blank one is plausibly an un-ticked checkbox rather than a
    // deliberate hide — the distinction a dry run needs before a first write.
    const publishedCell = get(row, "published");
    if (!publishedCell) plan.publishedBlankIds.push(id);

    const out: SheetBusinessRow = {
      id,
      name,
      slug: existing.slugById[id] ?? uniqueSlug(slugify(name, id), taken),
      category: get(row, "category"),
      published: parseBool(publishedCell),
      synced_at: nowIso,
    };
    const desc = get(row, "description"); if (desc) out.description = desc;
    const addr = get(row, "address"); if (addr) out.address = addr;
    const web = get(row, "website"); if (web) out.website = web;
    const email = get(row, "email"); if (email) out.email = email;
    const hours = get(row, "hours"); if (hours) out.hours_text = hours;
    const subs = splitList(get(row, "subcategories")); if (subs.length) out.subcategories = subs;
    if (phone) out.phone = phone;
    // Only set photos when the sheet names an image — otherwise leave any existing
    // photos untouched (upsert won't overwrite a column that isn't in the payload).
    if (image) out.photos = [storageUrl(supabaseUrl, image)];

    plan.upserts.push(out);
  });

  return plan;
}
