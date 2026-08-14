// One-way Google Calendar → Supabase `events` sync (Stage 1, Phase 1).
// The public ICS feed is the system of record for calendar events: rows are
// upserted on `gcal_event_id` (the ICS UID minus "@google.com", matching the
// ids Base44 stored), so re-runs are idempotent and calendar edits flow in.
// Rows the calendar doesn't know about (gcal_event_id IS NULL — Base44 imports,
// app submissions) are never touched. A FUTURE row whose calendar entry
// disappears is deleted (the feed mirrors the calendar; the snapshot is the
// archive); an entry the feed marks STATUS:CANCELLED is kept as 'cancelled'.
// Identical (title, start) pairs inside the feed are collapsed — Greg's
// calendar has a few duplicate entries — preferring the id already in the DB.
//
// Usage:
//   node scripts/sync-gcal-events.mjs                    # local stack (demo keys)
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/sync-gcal-events.mjs
//   DRY_RUN=1 …       print the plan, write nothing
//   ICS_FILE=path …   parse a local .ics instead of fetching (tests/offline)
import { build } from "esbuild";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { planSync } from "./lib/gcal-transform.mjs";

const CALENDAR_ID =
  "c_2422dd7f40698cb2c96ec4acc8b52491b88c48d8882c3c929de5b79084d050bb@group.calendar.google.com";
const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
const CALENDAR_TZ = "America/Los_Angeles";
const HORIZON_DAYS = 400; // how far ahead open-ended recurring series expand
const DRY = !!process.env.DRY_RUN;

// Local-stack demo keys as defaults (same convention as scripts/rls-test.mjs);
// hosted runs pass real values via env — never hard-coded, never committed.
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54421";
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// Reuse the app's DST-safe Pacific wall-clock → UTC conversion (src/lib/calendar.ts),
// bundled the same way the Base44 import does, so times stay consistent everywhere.
const ROOT = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "rc-gcal-"));
await build({
  entryPoints: [path.join(ROOT, "src/lib/calendar.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(tmp, "calendar.mjs"), logLevel: "error",
});
const { eventStartToUtc } = await import(path.join(tmp, "calendar.mjs"));

const icsText = process.env.ICS_FILE
  ? readFileSync(process.env.ICS_FILE, "utf8")
  : await (async () => {
      const res = await fetch(ICS_URL);
      if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
      return res.text();
    })();

// Existing calendar-linked rows: needed BEFORE planning, because the abort guard has to
// know whether "feed parsed to nothing" would mean deleting real data.
const { data: existing, error: exErr } = await db
  .from("events")
  .select("id, gcal_event_id, title, start_at, status")
  .not("gcal_event_id", "is", null)
  .limit(5000);
if (exErr) throw new Error(`prefetch failed: ${exErr.message}`);

const plan = planSync({
  icsText,
  existing,
  now: new Date(),
  eventStartToUtc,
  calendarTz: CALENDAR_TZ,
  horizonDays: HORIZON_DAYS,
});

console.log(`Feed: ${plan.veventCount} VEVENTs (${process.env.ICS_FILE ?? "live"})`);
for (const c of plan.collapsed) console.log(`  ~ ${c}`);
for (const w of plan.warnings) console.log(`  ! ${w}`);

// Run-level abort: leave existing data untouched and FAIL, so CI notifies rather than
// silently deleting every future event (see the guard in lib/gcal-transform.mjs).
if (!plan.ok) {
  console.error(`ABORTED: ${plan.abortReason}`);
  process.exit(1);
}

console.log(`Plan: ${plan.rows.length} occurrences → ${plan.inserts.length} new, ${plan.refreshes} refreshed, ${plan.vanished.length} vanished future row(s) to delete`);
for (const r of plan.inserts) console.log(`  + ${r.start_at.slice(0, 10)}  ${r.title}`);
for (const e of plan.vanished) console.log(`  - ${e.start_at.slice(0, 10)}  ${e.title} (removed from calendar)`);

if (DRY) { console.log("DRY_RUN — no writes."); process.exit(0); }

// ---------- write ----------
for (let i = 0; i < plan.rows.length; i += 200) {
  const { error } = await db.from("events").upsert(plan.rows.slice(i, i + 200), { onConflict: "gcal_event_id" });
  if (error) throw new Error(`upsert failed: ${error.message}`);
}
if (plan.vanished.length) {
  const { error } = await db.from("events").delete().in("gcal_event_id", plan.vanished.map((e) => e.gcal_event_id));
  if (error) throw new Error(`delete failed: ${error.message}`);
}

const { count } = await db.from("events").select("id", { count: "exact", head: true });
console.log(`Done. events table now has ${count} rows (${plan.warnings.length} warning(s)).`);
