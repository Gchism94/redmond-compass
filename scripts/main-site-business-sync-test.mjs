import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

let pass = 0;
const ok = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  pass++;
  console.log(`PASS ${message}`);
};

const dir = await mkdtemp(path.join(tmpdir(), "main-site-sync-test-"));
const outfile = path.join(dir, "planner.mjs");
await build({
  entryPoints: [path.resolve("scripts/lib/main-site-business-sync.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  logLevel: "silent",
});

try {
  const { buildMainSiteBusinessPlan, mainSiteBusinessesToValues } = await import(pathToFileURL(outfile).href);
  const payload = { businesses: [
    {
      id: "b1", name: "Coffee Test", category: "food-drink", subcategory: "Cafe",
      categories: ["food-drink", "Coffee"], description: "Local coffee", address: "1 Main St",
      phone: "541-555-0123", hours: "Mon-Fri 7am-4pm, Sat 8am-2pm, Closed Sun",
      status: "approved", profile_enabled: true,
    },
    {
      id: "b2", name: "Appointment Test", category: "services", hours: "By appointment",
      status: "approved", profile_enabled: true,
    },
    { id: "hidden", name: "Hidden", category: "services", status: "pending", profile_enabled: true },
  ] };
  const values = mainSiteBusinessesToValues(payload, 2);
  ok(values.length === 3, "only approved, profile-enabled businesses enter the plan");
  ok(values[1][4] === "Cafe; Coffee", "primary category is not duplicated in subcategories");

  const existing = {
    slugById: { b2: "appointment-test" },
    publishedById: { b2: true },
    syncedById: { b2: true },
    ownerHoursById: { b2: true },
  };
  const { plan, summary } = buildMainSiteBusinessPlan(payload, "https://example.supabase.co", "2026-09-02T00:00:00Z", existing, 2);
  ok(plan.ok && plan.upserts.length === 2, "valid feed produces two idempotent upserts");
  const coffee = plan.upserts.find((row) => row.id === "b1");
  ok(coffee?.hours?.week.sun.closed === true && coffee.hours.week.mon.open === "07:00", "clear prose becomes structured hours with closed days");
  ok(coffee?.phone === "+15415550123", "phone normalization is shared with the Sheet importer");
  const appointment = plan.upserts.find((row) => row.id === "b2");
  ok(appointment?.hours_text === "By appointment" && !("hours" in appointment), "claimed-owner structured hours are never overwritten by prose");
  ok(summary.newIds.count === 1 && summary.hours.parsed === 1, "dry-run summary reports inserts and parsed schedules");

  let refused = false;
  try { mainSiteBusinessesToValues({ businesses: [] }, 2); } catch { refused = true; }
  ok(refused, "unexpectedly small feed is rejected before writes");
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log(`\n${pass}/${pass} main-site business sync checks passed`);
