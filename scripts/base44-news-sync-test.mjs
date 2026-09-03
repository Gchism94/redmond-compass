import { buildNewsSyncPlan, newsFeedUrl, slugify } from "./lib/base44-news-sync.mjs";
import { enrichNewsImages, extractSocialImage, newsSourceCandidates, safePublicUrl, stableNewsImageUrl } from "./lib/news-image-enrichment.mjs";

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
const existing = [
  { id: "n-old", slug: "a-shared-url", image: "https://images.example.com/existing.jpg" },
  { id: "another", slug: "daily-news-redmond-beyond" },
];
const plan = buildNewsSyncPlan(records, existing);

ok(plan.ok, "valid public feed produces a plan");
ok(plan.rows.length === 2, "every valid upstream record is mapped");
ok(plan.rows[0].slug === "a-shared-url", "existing article slug is preserved");
ok(plan.rows[1].slug !== "daily-news-redmond-beyond", "new slug collision gets a stable suffix");
ok(plan.rows[1].published_at === "2026-09-01T12:00:00Z", "date-only publication keeps its Redmond calendar date");
ok(plan.rows[1].pinned === true && plan.rows[1].source === "Redmond Compass", "editorial fields and source default map correctly");
ok(plan.rows[0].image === "https://images.example.com/existing.jpg", "a previously resolved thumbnail survives later upstream nulls");
ok(!Object.values(plan.rows[1]).includes(undefined), "upsert payload contains no undefined values");
ok(buildNewsSyncPlan([], existing).ok === false, "unexpected empty feed aborts when an archive exists");
ok(buildNewsSyncPlan([], []).ok === true, "empty feed is a safe no-op for a new database");
ok(buildNewsSyncPlan({ rows: [] }, existing).ok === false, "non-array response aborts");
ok(slugify("Café & Community") === "cafe-community", "slug generation is ASCII and deterministic");
ok(newsFeedUrl("https://redmondcompass.com/").includes("/entities/NewsPost?"), "bridge reads the public NewsPost entity");

const duplicate = buildNewsSyncPlan([records[0], { ...records[0], title: "Changed" }], existing);
ok(duplicate.rows.length === 1, "duplicate upstream ids cannot enter one upsert batch");
ok(duplicate.warnings.length === 1, "duplicate upstream ids are visible in logs");

const sourceCandidates = newsSourceCandidates({
  source_url: null,
  body: "[Publisher](https://news.example.com/) and [Full story](https://news.example.com/2026/09/redmond-story/)",
});
ok(sourceCandidates[0].includes("/2026/09/redmond-story/"), "direct article links outrank publisher homepages");
ok(
  safePublicUrl("http://127.0.0.1/private") === null && safePublicUrl("https://[::1]/private") === null,
  "metadata enrichment rejects private and non-HTTPS targets",
);
ok(stableNewsImageUrl("https://scontent.example.fbcdn.net/signed.jpg?expires=soon") === null, "expiring Facebook CDN images are never persisted");
ok(
  extractSocialImage('<meta content="https://cdn.example.com/photo.jpg?width=800&amp;height=450" property="og:image">', "https://news.example.com/story")
    === "https://cdn.example.com/photo.jpg?width=800&height=450",
  "Open Graph images map regardless of attribute order and decode HTML entities",
);

const enrichment = await enrichNewsImages([{
  id: "n-image",
  body: "[Story](https://news.example.com/2026/redmond-story)",
  image: null,
}], {
  limit: 1,
  fetchImpl: async () => new Response(
    '<html><head><meta property="og:image" content="/media/redmond.jpg"></head></html>',
    { status: 200, headers: { "content-type": "text/html" } },
  ),
});
ok(enrichment.rows[0].image === "https://news.example.com/media/redmond.jpg", "missing images are resolved from publisher metadata");
ok(enrichment.enriched.length === 1 && enrichment.unresolved.length === 0, "image enrichment reports its outcome");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
