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

export interface SheetBusinessRow {
  id: string;
  name: string;
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
  skipped: { row: number; reason: string }[];
  warnings: { row: number; reason: string }[];
}

const norm = (h: string) => h.trim().toLowerCase();

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

/**
 * Turn the raw Sheet values matrix (row 0 = headers) into a write plan.
 * @param values  the Google Sheets `values` array (array of string rows)
 * @param supabaseUrl  for building public image URLs from bucket filenames
 * @param nowIso  synced_at stamp (passed in — Deno/Node both supply it)
 */
export function buildSyncPlan(values: string[][], supabaseUrl: string, nowIso: string): SyncPlan {
  const plan: SyncPlan = {
    ok: true, headerWarnings: [], upserts: [], sheetIds: [], skipped: [], warnings: [],
  };

  if (!values || values.length === 0) {
    return { ...plan, ok: false, abortReason: "Sheet is empty (no header row) — aborting to protect existing data." };
  }
  const headers = values[0].map(norm);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length) {
    return { ...plan, ok: false, abortReason: `Header row missing required column(s): ${missing.join(", ")} — schema drift, aborting.` };
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
    const out: SheetBusinessRow = {
      id,
      name,
      category: get(row, "category"),
      published: parseBool(get(row, "published")),
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
