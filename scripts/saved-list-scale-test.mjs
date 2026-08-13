// Scale regression test for the "resolve ids against a capped page" bug (audit 2026-08-13).
//
// THE BUG THIS EXISTS TO CATCH: SavedScreen / HomeScreen / CommunityScreen resolved a
// user-held list of business ids against `listBusinesses({ limit: 50 })`. With 133 listings,
// a business ranked 51st+ silently vanished from the user's own Saved screen even though the
// id was stored correctly in their profile. Same root pattern capped the Claim intake.
//
// WHY IT NEEDS A BIG FIXTURE: the mock seed has 13 businesses, so every existing test passed
// — 13 < 50 means the cap never bites. This test therefore builds a directory of 133 (the
// real production row count) and asserts specifically on rows ranked past the page size.
//
// Runs the REAL MockDataSource against a synthetic directory injected through its own
// localStorage overlay, so it exercises the shipped code path, not a reimplementation.
//   Usage:  node scripts/saved-list-scale-test.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIRECTORY_SIZE = 133; // production row count on 2026-08-13
const PAGE_CAP = 50; // the cap the screens used to resolve against

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

// ---- a synthetic directory of DIRECTORY_SIZE businesses -------------------------------
// Distance from Redmond centre grows with the index, and "relevance" sorts nearest-first,
// so index N is reliably ranked Nth. That makes "ranked past the cap" precise rather than
// incidental — biz-000 is always first, biz-132 always last.
const REDMOND = { lat: 44.2726, lng: -121.1739 };
const businesses = Array.from({ length: DIRECTORY_SIZE }, (_, i) => ({
  id: `biz-${String(i).padStart(3, "0")}`,
  name: `Test Business ${String(i).padStart(3, "0")}`,
  slug: `test-business-${String(i).padStart(3, "0")}`,
  category: "Food & Drink",
  description: "",
  address: `${i} Test St`,
  geo: { lat: REDMOND.lat + i * 0.001, lng: REDMOND.lng },
  photos: [],
  amenityTags: [],
  // every 7th is already claimed — the Claim intake must never offer these
  claimed: i % 7 === 0,
  verified: false,
  tier: "free",
  createdAt: "2026-01-01T00:00:00.000Z",
}));
const CLAIMED_COUNT = businesses.filter((b) => b.claimed).length;
const UNCLAIMED_COUNT = DIRECTORY_SIZE - CLAIMED_COUNT;

// ---- minimal browser stubs the MockDataSource needs ------------------------------------
const store = new Map([
  ["rc.owner.v1", JSON.stringify({
    newBusinesses: businesses, patches: {}, newBulletins: [], newEvents: [], recommendedBusinessIds: [],
  })],
]);
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => store.clear(),
};

// ---- bundle the real source (aliases resolved like the app's) --------------------------
const tmp = mkdtempSync(path.join(tmpdir(), "rc-scale-"));
await build({
  entryPoints: [path.join(ROOT, "src/data/mock/MockDataSource.ts")],
  bundle: true, format: "esm", platform: "node", outfile: path.join(tmp, "mock.mjs"),
  logLevel: "error",
  alias: { "@": path.join(ROOT, "src"), "@config": path.join(ROOT, "compass.config.ts") },
  define: { "import.meta.env.DEV": "false", "import.meta.env.VITE_DATA_SOURCE": '"mock"' },
});
const { MockDataSource } = await import(path.join(tmp, "mock.mjs"));
const ds = new MockDataSource();

// The seed ships 13 businesses alongside our 133 — the directory is the union.
const all = await ds.listBusinesses({});
ok(all.total >= DIRECTORY_SIZE, `fixture directory is bigger than the page cap (${all.total} rows > ${PAGE_CAP})`);

// Rank every business so "outside the first 50" is an exact claim, not an assumption.
const ranked = (await ds.listBusinesses({ sort: "relevance" })).items;
const deep = ranked[ranked.length - 1];            // dead last
const justPastCap = ranked[PAGE_CAP];              // rank 51 — the first one the cap drops
const inPage = ranked[0];                          // rank 1 — always visible either way
ok(ranked.indexOf(deep) >= PAGE_CAP && ranked.indexOf(justPastCap) === PAGE_CAP,
   `picked businesses ranked #${ranked.indexOf(justPastCap) + 1} and #${ranked.indexOf(deep) + 1} (both past the cap)`);

// ── 1. Reproduce the OLD behaviour, to prove the fixture actually triggers the bug ──────
const cappedPage = (await ds.listBusinesses({ limit: PAGE_CAP })).items;
ok(cappedPage.length === PAGE_CAP, `capped page returns exactly ${PAGE_CAP}`);

const oldResolve = (ids) => {
  const byId = new Map(cappedPage.map((b) => [b.id, b]));      // the old bizById
  return ids.map((id) => byId.get(id)).filter(Boolean);
};
ok(oldResolve([deep.id]).length === 0,
   "OLD pattern LOSES a save ranked past the cap (bug reproduced — fixture is valid)");
ok(oldResolve([justPastCap.id]).length === 0,
   "OLD pattern loses the very first business past the cap (rank 51)");
ok(oldResolve([inPage.id]).length === 1,
   "OLD pattern kept in-page saves — which is exactly why this shipped unnoticed");

// ── 2. The FIX: resolve by id ───────────────────────────────────────────────────────────
ok((await ds.listBusinessesByIds([deep.id])).length === 1,
   "listBusinessesByIds finds a business ranked past the cap");
ok((await ds.listBusinessesByIds([justPastCap.id]))[0]?.id === justPastCap.id,
   "listBusinessesByIds returns the right row for rank 51");

// The exact SavedScreen resolution, end to end: profile ids → map → ordered list.
const savedIds = [deep.id, inPage.id, justPastCap.id];
const fetched = await ds.listBusinessesByIds(savedIds);
const byId = new Map(fetched.map((b) => [b.id, b]));
const resolved = savedIds.map((id) => byId.get(id)).filter(Boolean);
ok(resolved.length === 3, `SavedScreen resolution keeps all 3 saves (${resolved.length}/3)`);
ok(resolved.map((b) => b.id).join(",") === savedIds.join(","),
   "result is ordered by the user's own save order, not the query's order");

// A heavy saver: every business in the directory saved at once.
const everyId = ranked.map((b) => b.id);
const allSaved = await ds.listBusinessesByIds(everyId);
ok(allSaved.length === everyId.length,
   `resolves ${everyId.length} saved ids with no ceiling (${allSaved.length})`);

// Edge cases the screens actually hit.
ok((await ds.listBusinessesByIds([])).length === 0, "empty id list → empty result, no error");
ok((await ds.listBusinessesByIds(["does-not-exist"])).length === 0,
   "unknown id (unpublished/deleted since saving) is dropped, not fatal");
ok((await ds.listBusinessesByIds([deep.id, deep.id, deep.id])).length === 1,
   "duplicate ids are de-duplicated");

// ── 3. Claim intake: unclaimed-only, searchable, and pageable past the cap ─────────────
const firstPage = await ds.listBusinesses({ claimed: false, sort: "name", limit: 25 });
ok(firstPage.items.length === 25, `claim page 1 returns 25 (${firstPage.items.length})`);
ok(firstPage.items.every((b) => !b.claimed), "claim list never offers an already-claimed listing");
// Derived from the directory itself — the seed ships its own mix of claimed/unclaimed, so
// hardcoding a number here would only be testing my arithmetic.
const expectedUnclaimed = ranked.filter((b) => !b.claimed).length;
ok(firstPage.total === expectedUnclaimed,
   `total counts ALL unclaimed listings, not the page (${firstPage.total} === ${expectedUnclaimed})`);
ok(expectedUnclaimed >= UNCLAIMED_COUNT,
   `fixture contributes ${UNCLAIMED_COUNT} unclaimed of its ${DIRECTORY_SIZE}`);
ok(firstPage.total > PAGE_CAP,
   "there are more unclaimed listings than the old cap — so the old screen hid some outright");

// "Show more" must eventually reach every unclaimed listing, including the last one.
const fullList = await ds.listBusinesses({ claimed: false, sort: "name", limit: firstPage.total });
ok(fullList.items.length === firstPage.total,
   `growing the limit reaches every unclaimed listing (${fullList.items.length}/${firstPage.total})`);
const lastUnclaimed = [...businesses].filter((b) => !b.claimed).sort((a, b) => a.name.localeCompare(b.name)).pop();
ok(fullList.items.some((b) => b.id === lastUnclaimed.id),
   `the alphabetically LAST unclaimed listing is reachable (${lastUnclaimed.name})`);

// Search must find a specific business regardless of its rank — the owner's real path.
const hit = await ds.listBusinesses({ claimed: false, text: deep.name, sort: "name", limit: 25 });
ok(hit.items.length >= 1 && hit.items.some((b) => b.id === deep.id),
   `search finds the deepest-ranked business by name (${deep.name})`);
ok(hit.total <= 2, `search narrows the list rather than returning everything (total=${hit.total})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
