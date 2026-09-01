import { buildNewsSyncPlan, newsFeedUrl, slugify } from "./lib/base44-news-sync.mjs";

let pass = 0;
let fail = 0;
const ok = (condition, label) => {
  if (condition) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.error(`FAIL  ${label}`); }
};

const records = [
  { id: "n-old", title: "Existing Story", summary: "Summary", body: "Body", published_date: "2026-08-31", source_name: "Redmond Compass" },
  { id: "n-new", title: "Daily News: Redmond & Beyond", published_date: "2026-09-01", category: "community", pinned: true },
];
const existing = [{ id: "n-old", slug: "a-shared-url" }, { id: "another", slug: "daily-news-redmond-beyond" }];
const plan = buildNewsSyncPlan(records, existing);

ok(plan.ok, "valid public feed produces a plan");
ok(plan.rows.length === 2, "every valid upstream record is mapped");
ok(plan.rows[0].slug === "a-shared-url", "existing article slug is preserved");
ok(plan.rows[1].slug !== "daily-news-redmond-beyond", "new slug collision gets a stable suffix");
ok(plan.rows[1].published_at === "2026-09-01T12:00:00Z", "date-only publication keeps its Redmond calendar date");
ok(plan.rows[1].pinned === true && plan.rows[1].source === "Redmond Compass", "editorial fields and source default map correctly");
ok(!Object.values(plan.rows[1]).includes(undefined), "upsert payload contains no undefined values");
ok(buildNewsSyncPlan([], existing).ok === false, "unexpected empty feed aborts when an archive exists");
ok(buildNewsSyncPlan([], []).ok === true, "empty feed is a safe no-op for a new database");
ok(buildNewsSyncPlan({ rows: [] }, existing).ok === false, "non-array response aborts");
ok(slugify("Café & Community") === "cafe-community", "slug generation is ASCII and deterministic");
ok(newsFeedUrl("https://redmondcompass.com/").includes("/entities/NewsPost?"), "bridge reads the public NewsPost entity");

const duplicate = buildNewsSyncPlan([records[0], { ...records[0], title: "Changed" }], existing);
ok(duplicate.rows.length === 1, "duplicate upstream ids cannot enter one upsert batch");
ok(duplicate.warnings.length === 1, "duplicate upstream ids are visible in logs");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
