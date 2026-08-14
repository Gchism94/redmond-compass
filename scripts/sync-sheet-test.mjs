// Unit test for the sync-sheet transform (the pure sheet→row logic that also runs
// in the edge function). Bundles supabase/functions/sync-sheet/transform.ts with
// esbuild and exercises header validation, row mapping, and the safety aborts —
// no Google, no network.  Usage:  node scripts/sync-sheet-test.mjs
//
// §9–§11 close the gap that let the slug bug ship: the old suite only checked the HEADER
// contract, so a payload that parsed perfectly but could never be INSERTed still passed.
// §10 now parses the real migrations and asserts the payload satisfies the actual
// `businesses` table contract (every key a real column; every not-null-without-default
// column present) — the write-side check that would have caught `slug` on day one.
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "rc-sync-"));
await build({
  entryPoints: [path.join(ROOT, "supabase/functions/sync-sheet/transform.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(tmp, "transform.mjs"), logLevel: "error",
});
const { buildSyncPlan, summarizePlan, normalizePhone, parseBool, slugify, uniqueSlug } =
  await import(path.join(tmp, "transform.mjs"));

const URL = "https://demo.supabase.co";
const NOW = "2026-07-11T00:00:00.000Z";
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const HEADERS = ["id", "name", "category", "phone", "address", "hours", "description", "website", "image", "published", "notes"];

// 1) happy path
let p = buildSyncPlan(
  [
    HEADERS,
    ["RC-0001", "Axel's Taco Shop", "food-drink", "(541) 555-1234", "1 SW A St", "Mon 9-5", "Tacos", "axels.com", "axels.jpg", "TRUE", "internal note"],
    ["RC-0002", "Wilson's", "shopping", "5415550000", "2 NW B St", "", "Furniture", "", "", "no"],
  ],
  URL, NOW,
);
ok(p.ok && p.upserts.length === 2, `happy path → ok, 2 upserts (${p.upserts.length})`);
ok(p.upserts[0].phone === "+15415551234", `phone normalized to E.164 (${p.upserts[0].phone})`);
ok(p.upserts[0].published === true && p.upserts[1].published === false, "published TRUE/no parsed");
ok(p.upserts[0].photos?.[0] === `${URL}/storage/v1/object/public/business-media/axels.jpg`, "image → bucket URL");
ok(p.upserts[1].photos === undefined, "blank image → photos omitted (existing preserved)");
ok(p.upserts[0].hours_text === "Mon 9-5" && p.upserts[0].synced_at === NOW, "hours_text + synced_at set");
ok(p.sheetIds.length === 2 && p.sheetIds.includes("RC-0001"), "sheetIds collected");

// 2) missing REQUIRED header → run-level abort, no writes
p = buildSyncPlan([["id", "name", "phone", "published"], ["RC-1", "X", "5415550000", "TRUE"]], URL, NOW);
ok(!p.ok && /category/.test(p.abortReason ?? ""), "missing required 'category' → aborted");
ok(/Saw 4 column\(s\): \[id, name, phone, published\]/.test(p.abortReason ?? ""), "abort echoes the parsed header row (self-diagnosing)");

// 2b) Base44 Title-Case headers parse with NO rename: 'Business ID' aliases to id, and
//     Name/Category match case-insensitively. Adding `published` is the only edit needed.
p = buildSyncPlan(
  [["Name", "Category", "Address", "Published", "Business ID"],
   ["Axel's", "food-drink", "1 SW A St", "TRUE", "6a44abc"]],
  URL, NOW,
);
ok(p.ok && p.upserts.length === 1, "Base44 headers + Published → parses via alias (no rename)");
ok(p.upserts[0].id === "6a44abc", `'Business ID' → id value mapped (${p.upserts[0].id})`);
ok(p.upserts[0].name === "Axel's" && p.upserts[0].category === "food-drink", "Title-Case Name/Category map by case");
ok(!p.headerWarnings.some((w) => /business id/i.test(w)), "'Business ID' not flagged unknown (aliased, not ignored)");

// 2c) the alias never papers over a genuinely absent required field: drop `published` and
//     the abort names ONLY published (id is resolved from 'Business ID') + echoes raw headers.
p = buildSyncPlan([["Name", "Category", "Address", "Business ID"], ["X", "food-drink", "1 A St", "6a44abc"]], URL, NOW);
ok(!p.ok && /missing required column\(s\): published\./.test(p.abortReason ?? ""), "no published → ONLY published missing (id via alias)");
ok(/Saw 4 column\(s\): \[Name, Category, Address, Business ID\]/.test(p.abortReason ?? ""), "abort still echoes raw headers incl 'Business ID'");

// 3) empty sheet → abort
ok(!buildSyncPlan([], URL, NOW).ok, "empty values → aborted");
// 4) header only, no data rows → abort
ok(!buildSyncPlan([HEADERS], URL, NOW).ok, "header-only sheet → aborted");

// 5) duplicate id + blank name skipped, run still ok
p = buildSyncPlan(
  [HEADERS,
    ["RC-9", "Good", "food-drink", "", "", "", "", "", "", "TRUE", ""],
    ["RC-9", "Dupe", "food-drink", "", "", "", "", "", "", "TRUE", ""],
    ["RC-10", "", "food-drink", "", "", "", "", "", "", "TRUE", ""]],
  URL, NOW,
);
ok(p.ok && p.upserts.length === 1 && p.skipped.length === 2, `dupe id + blank name skipped (${p.skipped.length})`);

// 6) unknown extra column → warning, still ok
p = buildSyncPlan([[...HEADERS, "mystery"], ["RC-3", "Y", "food-drink", "", "", "", "", "", "", "TRUE", "", "??"]], URL, NOW);
ok(p.ok && p.headerWarnings.some((w) => /mystery/.test(w)), "unknown column → warned, not fatal");

// 7) unparseable phone → warning, row kept
p = buildSyncPlan([HEADERS, ["RC-4", "Z", "food-drink", "call me", "", "", "", "", "", "TRUE", ""]], URL, NOW);
ok(p.ok && p.upserts.length === 1 && p.warnings.length === 1, "bad phone → kept + warned");

// 7b) Featured (Base44's ranking flag) can NEVER reach the DB — equal ranking is non-negotiable.
//     A row with Featured: TRUE parses, but the upsert payload carries no ranking/boost field.
p = buildSyncPlan([[...HEADERS, "Featured"], ["RC-5", "Boosted?", "food-drink", "", "", "", "", "", "", "TRUE", "", "TRUE"]], URL, NOW);
const RANK_KEYS = ["featured", "rank", "boost", "priority", "weight", "promoted", "pinned", "sponsored"];
const outKeys = Object.keys(p.upserts[0] ?? {});
ok(p.ok && p.upserts.length === 1, "Featured row still parses");
ok(!outKeys.some((k) => RANK_KEYS.includes(k.toLowerCase())), `no ranking/boost field in payload (keys: ${outKeys.join(",")})`);
ok(p.headerWarnings.some((w) => /featured/i.test(w)), "Featured seen but ignored (unmapped column)");

// 7c) `published` is fail-closed for a public directory: a blank/new row stays HIDDEN, and
//     only an explicit truthy value publishes. A Google Sheets checkbox serializes to the
//     string TRUE/FALSE via the values API, so a checked box === "TRUE".
const pubOf = (cell) =>
  buildSyncPlan([HEADERS, ["RC-P", "N", "food-drink", "", "", "", "", "", "", cell, ""]], URL, NOW).upserts[0]?.published;
ok(pubOf("") === false, "published: blank → hidden (fail-closed; still upserted, just not-published)");
ok(pubOf("FALSE") === false, "published: FALSE → hidden");
ok(pubOf("No") === false, "published: No → hidden");
ok(pubOf("TRUE") === true, "published: TRUE / checked checkbox → visible");

// 8) primitives
ok(parseBool("TRUE") && parseBool("yes") && !parseBool("") && !parseBool("no"), "parseBool");
ok(normalizePhone("(541) 640-3800").phone === "+15416403800", "normalizePhone US 10-digit");

// ───────────────────────────────────────────────────────────────────────────────────────
// 9) REPRESENTATIVE FIXTURE — the real Sheet's shape, end to end.
//    Modeled on the live tab ("Redmond Compass Business Directory Backup - 2026-07-05"):
//    Base44 Title-Case headers, `Business ID` (not `id`) carrying real 24-hex ids, an added
//    `Published` checkbox, a `Featured` column that must never reach the DB, and extra
//    columns the parser ignores. Row values mirror actual live records.
// ───────────────────────────────────────────────────────────────────────────────────────
const SHEET_HEADERS = [
  "Name", "Category", "Subcategories", "Description", "Address", "Phone", "Website",
  "Email", "Hours", "Image", "Featured", "Notes", "Published", "Business ID",
];
const row = (o) => SHEET_HEADERS.map((h) => o[h] ?? "");
const REAL_ROWS = [
  // already in the DB (id + slug known) — an apostrophe name, like General Duffy's
  row({ "Business ID": "6a121b80201bcb", Name: "General Duffy's Waterhole", Category: "Bars & Breweries",
        Phone: "(541) 640-3800", Address: "404 SW Forest Ave", Hours: "Mon-Sun 11am-10pm",
        Description: "Outdoor food hall", Website: "generalduffys.com", Image: "duffys.jpg",
        Published: "TRUE", Featured: "TRUE", Subcategories: "Beer; Live Music" }),
  // already in the DB, name has a comma — like "Redmond, OR Farmers Market"
  row({ "Business ID": "6a05e53157c8ee", Name: "Redmond, OR Farmers Market", Category: "Shopping",
        Address: "Centennial Park", Published: "TRUE" }),
  // BRAND NEW id — the exact case that used to 500 the whole run
  row({ "Business ID": "6a99newlisting01", Name: "Juniper Ridge Bakery", Category: "Food & Drink",
        Phone: "5415551234", Published: "TRUE" }),
  // new id whose name collides with the new row above
  row({ "Business ID": "6a99newlisting02", Name: "Juniper Ridge Bakery", Category: "Food & Drink",
        Published: "TRUE" }),
  // new id, name collides with an EXISTING db slug (different id)
  row({ "Business ID": "6a99newlisting03", Name: "General Duffy's Waterhole", Category: "Bars & Breweries",
        Published: "TRUE" }),
  // unpublished row — still synced, just hidden
  row({ "Business ID": "6a99newlisting04", Name: "Café Ünïcode", Category: "Food & Drink", Published: "" }),
  // name that slugifies to nothing → must still produce a usable, non-empty slug
  row({ "Business ID": "6a99newlisting05", Name: "!!! ???", Category: "Other", Published: "TRUE" }),
];
// what the DB already holds (mirrors the live convention: naive slugify of the name)
const EXISTING = {
  slugById: {
    "6a121b80201bcb": "general-duffy-s-waterhole",
    "6a05e53157c8ee": "redmond-or-farmers-market",
    "6a0000000other": "steppe-ysme", // an app-created listing with a random suffix
  },
};

p = buildSyncPlan([SHEET_HEADERS, ...REAL_ROWS], URL, NOW, EXISTING);
ok(p.ok && p.upserts.length === 7, `real-shape sheet → ok, 7 upserts (${p.upserts.length})`);
const bySheetId = Object.fromEntries(p.upserts.map((u) => [u.id, u]));

ok(p.upserts.every((u) => typeof u.slug === "string" && u.slug.length > 0),
   "EVERY upsert carries a non-empty slug (the not-null column that used to abort the run)");
ok(bySheetId["6a121b80201bcb"].slug === "general-duffy-s-waterhole",
   `existing row KEEPS its slug — /b/ URLs survive a sync (${bySheetId["6a121b80201bcb"].slug})`);
ok(bySheetId["6a05e53157c8ee"].slug === "redmond-or-farmers-market",
   "second existing row keeps its slug too");
ok(bySheetId["6a99newlisting01"].slug === "juniper-ridge-bakery",
   `new row → slugified name (${bySheetId["6a99newlisting01"].slug})`);
ok(bySheetId["6a99newlisting02"].slug === "juniper-ridge-bakery-2",
   `in-batch name collision → -2 suffix (${bySheetId["6a99newlisting02"].slug})`);
ok(bySheetId["6a99newlisting03"].slug === "general-duffy-s-waterhole-2",
   `collision with an EXISTING db slug → -2 suffix (${bySheetId["6a99newlisting03"].slug})`);
ok(bySheetId["6a99newlisting04"].slug === "cafe-unicode",
   `diacritics folded, not dropped (${bySheetId["6a99newlisting04"].slug})`);
ok(/^listing-/.test(bySheetId["6a99newlisting05"].slug),
   `unslugifiable name → id-derived fallback, never empty (${bySheetId["6a99newlisting05"].slug})`);
ok(new Set(p.upserts.map((u) => u.slug)).size === p.upserts.length,
   "all slugs in the batch are unique (would satisfy the UNIQUE index)");
ok(bySheetId["6a99newlisting04"].published === false && bySheetId["6a121b80201bcb"].published === true,
   "published checkbox: blank → false (fail-closed), TRUE → true");
ok(!Object.keys(bySheetId["6a121b80201bcb"]).some((k) => /featured|rank|boost/i.test(k)),
   "Featured column still never reaches the payload");
// slug generation must be deterministic: same input ⇒ same output, run after run
const again = buildSyncPlan([SHEET_HEADERS, ...REAL_ROWS], URL, NOW, EXISTING);
ok(JSON.stringify(again.upserts) === JSON.stringify(p.upserts),
   "plan is deterministic across runs (no randomness in slug assignment)");

// ───────────────────────────────────────────────────────────────────────────────────────
// 10) WRITE CONTRACT — validate the payload against the REAL `businesses` schema, parsed
//     from supabase/migrations/*.sql. This is the check the suite was missing: it fails if
//     the payload omits a not-null-without-default column (the slug bug) or names a column
//     that doesn't exist (which PostgREST would reject at runtime).
// ───────────────────────────────────────────────────────────────────────────────────────
function parseBusinessesSchema() {
  const dir = path.join(ROOT, "supabase/migrations");
  const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n")
    // Strip `--` comments FIRST: these migrations document columns inline, and those
    // comments contain commas and parens (e.g. hours' `-- { week: {mon:{…}, …} }`) that
    // would otherwise be read as top-level separators and swallow the next column.
    .replace(/--[^\n]*/g, "");
  const columns = new Map(); // name → { notNull, hasDefault }
  const addColumn = (name, spec) => {
    const s = spec.toLowerCase();
    columns.set(name, {
      notNull: /\bnot\s+null\b/.test(s),
      hasDefault: /\bdefault\b/.test(s) || /\bprimary\s+key\b/.test(s) || /\bgenerated\b/.test(s),
    });
  };
  // Split a parenthesised body on top-level commas only (defaults contain commas + parens).
  const topLevelSplit = (body) => {
    const out = []; let depth = 0, cur = "";
    for (const ch of body) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  };
  // create table public.businesses ( … )
  const create = sql.match(/create\s+table\s+public\.businesses\s*\(([\s\S]*?)\n\);/i);
  if (create) {
    for (const part of topLevelSplit(create[1])) {
      const line = part.replace(/--[^\n]*/g, "").trim();
      const m = line.match(/^([a-z_][a-z0-9_]*)\s+(.+)$/is);
      if (m && !/^(primary|unique|foreign|constraint|check)\b/i.test(m[1])) addColumn(m[1], m[2]);
    }
  }
  // alter table public.businesses add column [if not exists] <name> <spec>[, …];
  const alterRe = /alter\s+table\s+public\.businesses\s+([\s\S]*?);/gi;
  for (const [, body] of sql.matchAll(alterRe)) {
    for (const part of topLevelSplit(body)) {
      const m = part.replace(/--[^\n]*/g, "").trim()
        .match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+(.+)$/is);
      if (m) addColumn(m[1], m[2]);
    }
  }
  return columns;
}

const schema = parseBusinessesSchema();
ok(schema.size > 20, `parsed businesses schema from migrations (${schema.size} columns)`);
ok(schema.has("slug") && schema.get("slug").notNull && !schema.get("slug").hasDefault,
   "schema check is meaningful: slug really is not-null-without-default");

const required = [...schema.entries()]
  .filter(([, c]) => c.notNull && !c.hasDefault)
  .map(([n]) => n);
ok(required.length > 0, `required (not-null, no default) columns: [${required.join(", ")}]`);

const unknownKeys = new Set();
const missingRequired = new Set();
const nullish = new Set();
for (const u of p.upserts) {
  for (const k of Object.keys(u)) if (!schema.has(k)) unknownKeys.add(k);
  for (const r of required) {
    if (!(r in u)) missingRequired.add(r);
    else if (u[r] === null || u[r] === undefined || u[r] === "") nullish.add(r);
  }
}
ok(unknownKeys.size === 0, `no payload key is absent from the table (${[...unknownKeys].join(", ") || "none"})`);
ok(missingRequired.size === 0,
   `every not-null-without-default column is present (${[...missingRequired].join(", ") || "none missing"})`);
ok(nullish.size === 0, `no required column is null/empty (${[...nullish].join(", ") || "none"})`);

// Regression guard, stated as the failure we actually shipped: drop slug from a payload and
// the contract check must catch it. (Proves the assertions above can fail, not just pass.)
const sabotaged = { ...p.upserts[0] };
delete sabotaged.slug;
ok(required.some((r) => !(r in sabotaged)),
   "contract check detects a payload missing slug (the exact 2026-08-13 production failure)");

// ───────────────────────────────────────────────────────────────────────────────────────
// 11) slug primitives
// ───────────────────────────────────────────────────────────────────────────────────────
ok(slugify("General Duffy's Waterhole") === "general-duffy-s-waterhole", "slugify matches the existing 133 rows' convention");
ok(slugify("5 Below Steakhouse & Breakfast Nook") === "5-below-steakhouse-breakfast-nook", "slugify: ampersand + digits");
ok(slugify("  Trailing / Spaces  ") === "trailing-spaces", "slugify trims and collapses");
ok(slugify("", "RC-0007") === "listing-rc-0007", "slugify: empty name → id fallback");
ok(slugify("", "") === "listing", "slugify: no name and no id → 'listing', never empty");
ok(slugify("x".repeat(200)).length <= 60, "slugify caps length");
ok(!/-$/.test(slugify("a".repeat(59) + " b")), "slugify never leaves a trailing hyphen after the cap");
const t = new Set(["taken"]);
ok(uniqueSlug("free", t) === "free" && uniqueSlug("taken", t) === "taken-2" && uniqueSlug("taken", t) === "taken-3",
   "uniqueSlug walks -2, -3 and mutates the taken set");

// ───────────────────────────────────────────────────────────────────────────────────────
// 12) DRY-RUN SUMMARY — the counts `?dry=1` reports must be right before we trust them to
//     decide whether a first real write is safe. Pure diff, so it's tested, not just
//     observed once in production.
// ───────────────────────────────────────────────────────────────────────────────────────
const DRY_HEADERS = ["id", "name", "category", "published"];
const dryPlan = buildSyncPlan(
  [DRY_HEADERS,
    ["keep-1",  "Stays Live",        "food-drink", "TRUE"],  // live → live
    ["blank-1", "Blank Checkbox",    "food-drink", ""],      // live → HIDDEN (blank cell)
    ["blank-2", "Blank Too",         "shopping",   "   "],   // live → HIDDEN (whitespace)
    ["nope-1",  "Deliberately Off",  "shopping",   "FALSE"], // live → HIDDEN (explicit)
    ["back-1",  "Coming Back",       "shopping",   "TRUE"],  // hidden → live
    ["new-1",   "Brand New",         "food-drink", "TRUE"],  // INSERT
    ["new-2",   "Brand New Two",     "food-drink", ""],      // INSERT, arrives hidden
  ],
  URL, NOW,
  {
    slugById:      { "keep-1": "stays-live", "blank-1": "blank-checkbox", "blank-2": "blank-too",
                     "nope-1": "deliberately-off", "back-1": "coming-back", "gone-1": "left-the-sheet",
                     "owner-1": "owner-created" },
    publishedById: { "keep-1": true, "blank-1": true, "blank-2": true, "nope-1": true,
                     "back-1": false, "gone-1": true, "owner-1": true },
    // gone-1 was synced before; owner-1 never was (owner-created) → must NOT be touched
    syncedById:    { "keep-1": true, "blank-1": true, "blank-2": true, "nope-1": true,
                     "back-1": true, "gone-1": true, "owner-1": false },
  },
);
const sum = summarizePlan(dryPlan, {
  slugById:      { "keep-1": "stays-live", "blank-1": "blank-checkbox", "blank-2": "blank-too",
                   "nope-1": "deliberately-off", "back-1": "coming-back", "gone-1": "left-the-sheet",
                   "owner-1": "owner-created" },
  publishedById: { "keep-1": true, "blank-1": true, "blank-2": true, "nope-1": true,
                   "back-1": false, "gone-1": true, "owner-1": true },
  syncedById:    { "keep-1": true, "blank-1": true, "blank-2": true, "nope-1": true,
                   "back-1": true, "gone-1": true, "owner-1": false },
});
ok(sum.newIds.count === 2 && sum.newIds.sample.includes("new-1") && sum.newIds.sample.includes("new-2"),
   `new ids counted (${sum.newIds.count})`);
ok(sum.existingIds === 5, `existing ids counted (${sum.existingIds})`);
ok(sum.wouldUnpublish.total === 3, `would-unpublish total (${sum.wouldUnpublish.total})`);
ok(sum.wouldUnpublish.blankCell.count === 2, `blank-cell unpublishes split out (${sum.wouldUnpublish.blankCell.count})`);
ok(sum.wouldUnpublish.explicitFalse.count === 1, `explicit-FALSE unpublishes split out (${sum.wouldUnpublish.explicitFalse.count})`);
ok(sum.wouldUnpublish.blankCell.sample.some((r) => r.id === "blank-2"),
   "whitespace-only cell counts as blank, not explicit");
ok(!sum.wouldUnpublish.blankCell.sample.some((r) => r.id === "new-2"),
   "a NEW row arriving unpublished is not counted as 'would unpublish' (nothing goes dark)");
ok(sum.wouldPublish === 1, `would-publish (hidden → live) counted (${sum.wouldPublish})`);
ok(sum.wouldSoftUnpublish.count === 1 && sum.wouldSoftUnpublish.sample[0] === "gone-1",
   `previously-synced row absent from the sheet → soft-unpublish (${sum.wouldSoftUnpublish.count})`);
ok(!sum.wouldSoftUnpublish.sample.includes("owner-1"),
   "owner-created row (synced_at null) is NEVER soft-unpublished");

// A first run against a never-synced DB must report ZERO soft-unpublishes — that's exactly
// today's production state (synced_at null on all 133 rows), so this pins the safe case.
const firstRun = summarizePlan(dryPlan, {
  slugById: { "keep-1": "stays-live" },
  publishedById: { "keep-1": true, "unrelated-1": true },
  syncedById: {}, // nothing ever synced
});
ok(firstRun.wouldSoftUnpublish.count === 0,
   "first-ever run soft-unpublishes nothing (synced_at null everywhere — today's prod state)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
