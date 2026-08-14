// Category vocabulary consistency (audit follow-up, 2026-08-14).
//
// THE BUG THIS EXISTS TO CATCH: the one-time Base44 import mapped the Sheet's slug-case
// categories to Title Case on the way in (migration/scripts/import-base44.mjs →
// CATEGORY_LABELS). sync-sheet does NOT do that conversion — it writes the Sheet value
// verbatim. So the first successful Sheet sync rewrote all 132 rows from "Food & Drink" to
// "food-drink", and because TOP_CATEGORIES only knew the Title-Case spelling, EVERY browse
// tile went empty: 1 of 133 businesses remained reachable by category.
//
// Nothing caught it. The write-contract test can't: `category` is `text not null`, so
// "food-drink" is perfectly LEGAL — it is semantically incompatible, which is a different
// question. The dry run can't either: it reports counts, not field-level diffs.
//
// So this asserts the question that actually matters — "can the app place this value?" —
// against real data, and fails loudly on drift. A new category typed into the Sheet, or a
// typo, now breaks CI instead of silently emptying a tile in production.
//
//   npm run test:categories                       # self-consistency + committed fixture
//   SUPABASE_URL=… SUPABASE_ANON_KEY=… npm run test:categories   # + the LIVE table
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "rc-cat-"));
await build({
  entryPoints: [path.join(ROOT, "src/lib/taxonomy.ts")],
  bundle: true, format: "esm", platform: "node", outfile: path.join(tmp, "tax.mjs"),
  logLevel: "error", absWorkingDir: ROOT, nodePaths: [path.join(ROOT, "node_modules")],
});
const { TOP_CATEGORIES, KNOWN_CATEGORY_VALUES, UNCATEGORIZED_VALUES, BUSINESS_CATEGORIES, topCategoryFor, categoryValuesFor, categoryLabelFor } =
  await import(path.join(tmp, "tax.mjs"));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

// ── 1. Self-consistency (pure — no network) ──────────────────────────────────────────────
{
  const seen = new Map();
  const dupes = [];
  for (const t of TOP_CATEGORIES) {
    for (const v of [...t.includes, ...(t.aliases ?? [])]) {
      if (seen.has(v) && seen.get(v) !== t.slug) dupes.push(`${v} → ${seen.get(v)} & ${t.slug}`);
      seen.set(v, t.slug);
    }
  }
  ok(dupes.length === 0, `no category value rolls up under two tiles (${dupes.join("; ") || "none"})`);

  // Aliases are STORAGE spellings; they must never reach the owner-facing <select>.
  const leaked = BUSINESS_CATEGORIES.filter((c) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(c) && c === c.toLowerCase() && c.includes("-"));
  ok(leaked.length === 0, `no slug-case alias leaked into the owner dropdown (${leaked.join(", ") || "none"})`);

  ok(new Set(KNOWN_CATEGORY_VALUES).size === KNOWN_CATEGORY_VALUES.length,
     "KNOWN_CATEGORY_VALUES has no duplicates");

  // topCategoryFor and categoryValuesFor must agree in both directions.
  const mismatched = [];
  for (const t of TOP_CATEGORIES) {
    if (t.slug === "more") continue;
    for (const v of categoryValuesFor(t.slug)) if (topCategoryFor(v) !== t.slug) mismatched.push(`${v}→${topCategoryFor(v)}≠${t.slug}`);
  }
  ok(mismatched.length === 0, `topCategoryFor agrees with categoryValuesFor (${mismatched.join(", ") || "consistent"})`);

  ok(UNCATEGORIZED_VALUES.every((v) => topCategoryFor(v) === "more"),
     "explicitly-uncategorised values resolve to the 'more' tile");
}

// ── 1b. Display labels — the stored value must never reach a visitor raw ─────────────────
// `businesses.category` holds the SHEET's vocabulary ("food-drink"), and four surfaces
// render it verbatim (result cards, profile header, Claim intake, search autocomplete).
// After the first Sheet sync the directory was telling people a business was in
// "food-drink" instead of "Food & Drink".
{
  ok(categoryLabelFor("food-drink") === "Food & Drink", `slug → display ("${categoryLabelFor("food-drink")}")`);
  ok(categoryLabelFor("bars-breweries") === "Bars & Breweries",
     `an alias maps to ITS OWN label, not the tile's ("${categoryLabelFor("bars-breweries")}")`);
  ok(categoryLabelFor("beauty-personal-care") === "Beauty & Personal Care",
     `ampersands restored ("${categoryLabelFor("beauty-personal-care")}")`);
  ok(categoryLabelFor("Food & Drink") === "Food & Drink", "an existing display value passes through untouched");
  ok(categoryLabelFor("Education") === "Education", "owner-entered Title Case is never rewritten");
  ok(categoryLabelFor("community-markets") === "Community & Markets",
     `uncategorised values get labels too ("${categoryLabelFor("community-markets")}")`);
  ok(categoryLabelFor("artisan-crafts") === "Artisan Crafts",
     `an UNKNOWN slug is still title-cased, never shown raw ("${categoryLabelFor("artisan-crafts")}")`);
  ok(categoryLabelFor("") === "", "empty input is passed through");
  // Every value the live data can hold must produce a human-readable label.
  const raw = KNOWN_CATEGORY_VALUES.filter((v) => categoryLabelFor(v) !== v && /^[a-z0-9-]+$/.test(categoryLabelFor(v)));
  ok(raw.length === 0, `no known value renders as raw slug-case (${raw.join(", ") || "none"})`);
}

// ── 2. Coverage against real data ────────────────────────────────────────────────────────
// The committed fixture is the vocabulary observed in the live table on 2026-08-14, AFTER
// the first successful Sheet sync — i.e. the Sheet's own spelling, which is what the app
// must now cope with. Live mode re-checks the same thing against production.
const FIXTURE = [
  "food-drink", "automotive", "shopping", "professionals", "home-services", "bars-breweries",
  "beauty-wellness", "pet-services", "entertainment", "sports-fitness", "beauty-personal-care",
  "transportation", "outdoors", "community-markets", "lodging", "education",
  // the one row that is NOT in the Sheet keeps its original Title-Case value
  "Education",
];

function checkVocabulary(values, label) {
  const known = new Set(KNOWN_CATEGORY_VALUES);
  const unknown = [...new Set(values)].filter((v) => !known.has(v));
  ok(unknown.length === 0,
     `[${label}] every category value is known to the taxonomy${unknown.length ? ` — UNPLACEABLE: ${unknown.map((u) => JSON.stringify(u)).join(", ")}` : ""}`);

  // A value can be "known" and still land in `more`. That is legal ONLY when it is listed
  // in UNCATEGORIZED_VALUES on purpose — otherwise it is an invisible tile.
  const uncat = new Set(UNCATEGORIZED_VALUES);
  const stranded = [...new Set(values)].filter((v) => topCategoryFor(v) === "more" && !uncat.has(v));
  ok(stranded.length === 0,
     `[${label}] no value silently falls through to 'more' (${stranded.join(", ") || "none"})`);
  return unknown.length === 0 && stranded.length === 0;
}
checkVocabulary(FIXTURE, "fixture");

// Every tile must be able to match something, or it renders as a dead entry in the grid.
{
  const empties = TOP_CATEGORIES.filter((t) => t.slug !== "more")
    .filter((t) => !FIXTURE.some((v) => topCategoryFor(v) === t.slug));
  ok(empties.length === 0, `[fixture] every browse tile matches at least one real value (${empties.map((e) => e.slug).join(", ") || "all populated"})`);
}

// ── 3. LIVE table (only when credentials are supplied) ───────────────────────────────────
const DB_URL = process.env.SUPABASE_URL; // not `URL` — that shadows the global constructor
const KEY = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
if (DB_URL && KEY) {
  const res = await fetch(`${DB_URL}/rest/v1/businesses?select=category`, { headers: { apikey: KEY } });
  if (!res.ok) {
    ok(false, `[live] could not read businesses (${res.status})`);
  } else {
    const rows = await res.json();
    const values = rows.map((r) => r.category);
    ok(rows.length > 0, `[live] read ${rows.length} businesses from ${new URL(DB_URL).host}`);
    checkVocabulary(values, "live");
    const byTile = {};
    for (const v of values) byTile[topCategoryFor(v)] = (byTile[topCategoryFor(v)] ?? 0) + 1;
    const reachable = Object.entries(byTile).filter(([s]) => s !== "more").reduce((n, [, c]) => n + c, 0);
    console.log(`      tile counts: ${Object.entries(byTile).map(([s, c]) => `${s}=${c}`).join("  ")}`);
    ok(reachable > values.length * 0.9,
       `[live] >90% of businesses are reachable from a browse tile (${reachable}/${values.length})`);
  }
} else {
  console.log("SKIP  [live] set SUPABASE_URL + SUPABASE_ANON_KEY to also check the live table");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
