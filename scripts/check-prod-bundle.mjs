// Acceptance gate for what a PRODUCTION build is allowed to contain (audit 2026-08-13,
// item 7). Run AFTER `npm run build`.  Usage:  node scripts/check-prod-bundle.mjs
//
// Two of these caught real shipped defects:
//   • the MockDataSource chunk + its fictional seed ("Juniper & Sage Cafe", …) were emitted
//     into every production build and precached by the service worker, because
//     `switch (kind)` never constant-folded;
//   • the internal component gallery shipped as a 14.7 KB chunk even after its ROUTE was
//     gated behind import.meta.env.DEV, because the top-level lazy() call wasn't tree-shaken.
//
// Neither was reachable through the UI, which is exactly why neither was noticed. This gate
// asserts the bundle, not the behaviour, so "not reachable" can't hide "still shipped".
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const ASSETS = path.join(DIST, "assets");

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

if (!existsSync(ASSETS)) {
  console.error("dist/assets not found — run `npm run build` first.");
  process.exit(1);
}
const files = readdirSync(ASSETS);
const read = (f) => readFileSync(path.join(ASSETS, f), "utf8");

// ── 1. the mock data source must not ship ────────────────────────────────────────────────
const mockChunks = files.filter((f) => /^(MockDataSource|seed)-/.test(f));
ok(mockChunks.length === 0,
   `no MockDataSource/seed chunk in the bundle (${mockChunks.join(", ") || "none"})`);

// The seed's business names must not appear in any DATA position. ClaimScreen legitimately
// uses one as a form placeholder ("e.g. Juniper & Sage Cafe"), so match the seed's slug
// form, which only ever appears in seed records — not in UI copy.
const seedSlugHits = files.filter((f) => /juniper-and-sage-cafe/i.test(read(f)));
ok(seedSlugHits.length === 0,
   `no fictional seed RECORDS in the bundle (${seedSlugHits.join(", ") || "none"})`);

// ── 2. dev-only surfaces must not ship ───────────────────────────────────────────────────
const galleryChunks = files.filter((f) => /^GalleryPage-/.test(f));
ok(galleryChunks.length === 0,
   `component gallery (DEV-only) not emitted (${galleryChunks.join(", ") || "none"})`);

// ── 3. the real data source MUST ship, wired to the hosted project ───────────────────────
const sbChunk = files.find((f) => /^SupabaseDataSource-/.test(f));
ok(!!sbChunk, `SupabaseDataSource chunk is present (${sbChunk ?? "MISSING"})`);
if (sbChunk) {
  const src = read(sbChunk);
  ok(/https:\/\/[a-z0-9]+\.supabase\.co/.test(src), "the Supabase project URL is baked into the bundle");
  ok(/sb_publishable_|eyJhbGciOi/.test(src), "a publishable/anon key is baked into the bundle");
}

// ── 4. nothing secret may ever reach the browser ─────────────────────────────────────────
const secretHits = files.filter((f) => /service_role|sb_secret_|SUPABASE_SERVICE_ROLE/.test(read(f)));
ok(secretHits.length === 0, `no service-role/secret key in the bundle (${secretHits.join(", ") || "none"})`);

// ── 5. the service worker must not precache anything above ───────────────────────────────
const swPath = path.join(DIST, "sw.js");
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, "utf8");
  const precachedMock = /"(?:assets\/)?(?:MockDataSource|seed|GalleryPage)-[A-Za-z0-9_-]+\.js"/.test(sw);
  ok(!precachedMock, "service worker precaches no mock/gallery chunk (would install it on every device)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
