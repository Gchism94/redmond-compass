// Unit test for the sync-sheet transform (the pure sheet→row logic that also runs
// in the edge function). Bundles supabase/functions/sync-sheet/transform.ts with
// esbuild and exercises header validation, row mapping, and the safety aborts —
// no Google, no network.  Usage:  node scripts/sync-sheet-test.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "rc-sync-"));
await build({
  entryPoints: [path.join(ROOT, "supabase/functions/sync-sheet/transform.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(tmp, "transform.mjs"), logLevel: "error",
});
const { buildSyncPlan, normalizePhone, parseBool } = await import(path.join(tmp, "transform.mjs"));

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

// 8) primitives
ok(parseBool("TRUE") && parseBool("yes") && !parseBool("") && !parseBool("no"), "parseBool");
ok(normalizePhone("(541) 640-3800").phone === "+15416403800", "normalizePhone US 10-digit");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
