// Pure contract tests for the main-site content mirror. No network or database writes.
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const temp = mkdtempSync(path.join(tmpdir(), "rc-content-sync-test-"));
const output = path.join(temp, "planner.mjs");
await build({
  entryPoints: [path.join(ROOT, "scripts/lib/main-site-content-sync.ts")],
  bundle: true, platform: "node", format: "esm", outfile: output, logLevel: "error",
});
const { buildMainSiteContentPlan, parseMainSiteTime } = await import(output);

let pass = 0, fail = 0;
const ok = (condition, message) => {
  console.log(`${condition ? "PASS" : "FAIL"}  ${message}`);
  condition ? pass++ : fail++;
};

ok(JSON.stringify(parseMainSiteTime("11am")) === JSON.stringify({ start: "11:00" }), "parses compact 12-hour time");
ok(JSON.stringify(parseMainSiteTime("6:00 PM - 8:30 PM")) === JSON.stringify({ start: "18:00", end: "20:30" }), "parses a time range");
ok(JSON.stringify(parseMainSiteTime("09:00")) === JSON.stringify({ start: "09:00" }), "parses 24-hour time");
ok(parseMainSiteTime("evening") === null, "does not invent a time from prose");

const now = new Date("2026-09-03T12:00:00Z");
const event = {
  id: "evt_1", status: "approved", title: "Autumn Market", date: "2026-11-01",
  time: "11am", location: "Centennial Park", description: "Local makers.",
  link: "example.com/bad", image_url: "https://cdn.example.test/market.jpg",
  submitter_name: "Community Team", submitter_email: "private@example.test",
  created_date: "2026-08-20T17:00:00Z", updated_date: "2026-08-22T18:00:00Z",
};
const post = {
  id: "post_1", status: "approved", business_id: "biz_1", title: "Fall menu",
  body: "Soup is back.", image_url: "https://cdn.example.test/soup.jpg",
  gallery_images: ["https://cdn.example.test/one.jpg", "javascript:bad"],
  created_date: "2026-09-01T12:00:00Z",
};
const businessClass = {
  id: "class_1", status: "approved", business_id: "biz_1", title: "Pottery basics",
  date: "2026-10-10", time: "6–8 PM", location: "Main studio",
  link: "https://example.test/class", created_date: "2026-09-01T12:00:00Z",
};
const plan = buildMainSiteContentPlan({
  events: [event], posts: [post], classes: [businessClass], businessIds: ["biz_1"],
  existingEvents: [], existingPosts: [], existingClasses: [], now, minimumEvents: 1,
});
ok(plan.events.length === 1 && plan.posts.length === 1 && plan.classes.length === 1, "maps approved events, posts, and classes");
ok(plan.events[0].start_at === "2026-11-01T19:00:00.000Z", `uses Redmond DST when converting event time (${plan.events[0].start_at})`);
ok(!("submitter_email" in plan.events[0]) && !JSON.stringify(plan).includes("private@example.test"), "does not persist public submitter email");
ok(plan.events[0].link_cta === null, "rejects a non-standard event link");
ok(plan.posts[0].title === "Fall menu" && plan.posts[0].gallery_images.length === 1, "preserves post title and safe media");
ok(plan.classes[0].status === "open" && plan.classes[0].business_id === "biz_1", "maps approved class to a public open class");

const overlap = buildMainSiteContentPlan({
  events: [event], posts: [post], classes: [businessClass], businessIds: ["biz_1"], now, minimumEvents: 1,
  existingEvents: [
    { id: "gcal_1", title: "Autumn Market", start_at: "2026-11-01T19:00:00Z", gcal_event_id: "gcal", source: null },
    { id: "ms_event_evt_1", title: "Autumn Market", start_at: "2026-11-01T19:00:00Z", source: "main_site", source_id: "evt_1" },
  ],
});
ok(overlap.events.length === 0 && overlap.deleteEventIds.includes("ms_event_evt_1"), "keeps another event source and removes the duplicate mirror row");

const missingBusiness = buildMainSiteContentPlan({
  events: [event], posts: [post], classes: [businessClass], businessIds: [], now, minimumEvents: 1,
  existingEvents: [], existingPosts: [{ id: "legacy-post", source_id: "post_1" }], existingClasses: [{ id: "legacy-class", source_id: "class_1" }],
});
ok(missingBusiness.posts.length === 0 && missingBusiness.classes.length === 0, "does not create orphaned owner content");
ok(missingBusiness.deletePostIds.includes("legacy-post") && missingBusiness.deleteClassIds.includes("legacy-class"), "cleans only stale main-site mirrors when source business is unavailable");

let guardFired = false;
try {
  buildMainSiteContentPlan({ events: [], posts: [], classes: [], businessIds: [], minimumEvents: 1 });
} catch (error) {
  guardFired = /Refusing a partial sync/.test(String(error));
}
ok(guardFired, "aborts before writes when the event feed is unexpectedly partial");

const migration = readFileSync(path.join(ROOT, "supabase/migrations/20260903000001_main_site_content_mirror.sql"), "utf8");
for (const table of ["bulletins", "events", "business_classes"]) {
  ok(migration.includes(`revoke insert, update, delete on public.${table} from authenticated`), `${table} app writes are revoked at the database boundary`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
