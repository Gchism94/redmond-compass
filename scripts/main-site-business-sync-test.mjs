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
      categories: ["food-drink", "Coffee"], tags: ["Breakfast"],
      description: "Local coffee", long_description: "Roasted in Redmond", address: "1 Main St",
      phone: "541-555-0123", hours: "Mon-Fri 7am-4pm, Sat 8am-2pm, Closed Sun",
      image_url: "https://images.example/coffee.png", instagram: "https://instagram.com/coffee",
      additional_locations: [{ label: "Kiosk", address: "2 Main St" }],
      hours_location_name: "Main shop", headshot_url: "https://images.example/owner.png",
      license_number: "OR-42", license_type: "Food service", referral_enabled: true,
      referral_promo_code: "COMPASS", updated_date: "2026-09-02T10:00:00Z",
      status: "approved", profile_enabled: true,
    },
    {
      id: "b2", name: "Appointment Test", category: "services", hours: "By appointment",
      status: "approved", profile_enabled: true,
    },
    {
      id: "b2-old", name: "Appointment Test", category: "services", hours: "",
      status: "approved", profile_enabled: true, updated_date: "2026-01-01",
    },
    { id: "hidden", name: "Hidden", category: "services", status: "pending", profile_enabled: true },
  ] };
  const values = mainSiteBusinessesToValues(payload, 2);
  ok(values.length === 3, "only approved, profile-enabled, unique businesses enter the plan");
  ok(values[1][4] === "Cafe; Breakfast", "subcategory and public tags mirror without duplicating category membership");

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
  ok(coffee?.photos?.[0] === "https://images.example/coffee.png", "main-site identity image reaches the app mirror");
  ok(coffee?.long_description === "Roasted in Redmond" && coffee?.socials?.instagram,
    "long description and social links reach the app mirror");
  ok(coffee?.extra_categories?.[0] === "Coffee" && coffee?.additional_locations?.[0]?.label === "Kiosk",
    "category memberships and additional locations reach the app mirror");
  ok(coffee?.hours_location_name === "Main shop" && coffee?.headshot_url && coffee?.license_type === "Food service",
    "remaining public owner-profile fields reach the app mirror");
  ok(coffee?.referral_enabled === true && coffee?.referral_promo_code === "COMPASS" && coffee?.source_updated_at,
    "referral metadata and authoritative update time are retained");
  ok(!("featured" in coffee), "the main site's featured flag remains excluded from equal-ranked app data");
  const appointment = plan.upserts.find((row) => row.id === "b2");
  ok(appointment?.hours_text === "By appointment" && !("hours" in appointment), "claimed-owner structured hours are never overwritten by prose");
  ok(summary.newIds.count === 1 && summary.hours.parsed === 1, "dry-run summary reports inserts and parsed schedules");
  ok(plan.upserts.some((row) => row.id === "b2") && !plan.upserts.some((row) => row.id === "b2-old"), "richer duplicate source record wins deterministically");

  const protectedOwner = [{ id: "owner-coffee", name: "Coffee Test" }];
  const protectedResult = buildMainSiteBusinessPlan(
    payload,
    "https://example.supabase.co",
    "2026-09-02T00:00:00Z",
    existing,
    2,
    protectedOwner,
  );
  ok(protectedResult.plan.upserts.length === 1, "same-name owner-created listing suppresses a duplicate source id");
  ok(protectedResult.ownerNameCollisions[0]?.ownerId === "owner-coffee", "owner/source id collision is observable in the run output");
  ok(protectedResult.sourceNameCollisions[0]?.suppressedIds[0] === "b2-old", "duplicate source ids are observable in the run output");

  let refused = false;
  try { mainSiteBusinessesToValues({ businesses: [] }, 2); } catch { refused = true; }
  ok(refused, "unexpectedly small feed is rejected before writes");
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log(`\n${pass}/${pass} main-site business sync checks passed`);
