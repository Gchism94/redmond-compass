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

// Wall-clock → UTC for any IANA zone (only used if an event carries a TZID
// other than the calendar's own; Google normally emits Z times or America/Los_Angeles).
function wallToUtc(tz, y, mo, d, h, mi, s) {
  let ts = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, hourCycle: "h23",
      }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
    );
    const rendered = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    const want = Date.UTC(y, mo - 1, d, h, mi, s);
    if (rendered === want) break;
    ts += want - rendered;
  }
  return new Date(ts);
}

// ---------- ICS parsing ----------
const unescapeText = (s) =>
  s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();

function parseIcs(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, ""); // RFC 5545 line unfolding
  const events = [];
  let cur = null;
  for (const line of unfolded.split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") { cur = []; continue; }
    if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const [name, ...paramParts] = line.slice(0, colon).split(";");
    const params = Object.fromEntries(paramParts.map((p) => p.split("=")));
    cur.push({ name: name.toUpperCase(), params, value: line.slice(colon + 1) });
  }
  return events.map((props) => {
    const get = (n) => props.find((p) => p.name === n);
    const all = (n) => props.filter((p) => p.name === n);
    return { get, all };
  });
}

// DTSTART/DTEND/EXDATE/RECURRENCE-ID value → { utc: Date|null, allDay, naive }
// naive = "YYYY-MM-DDTHH:MM:SS" local wall clock (for recurrence stepping).
function parseDt(prop) {
  if (!prop) return null;
  const v = prop.value.trim();
  if (prop.params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
    const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return { allDay: true, date, utc: eventStartToUtc(`${date}T12:00:00`) }; // noon-local convention (matches import)
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const naive = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  if (z === "Z") return { allDay: false, naive: null, utc: new Date(`${naive}Z`) };
  const tz = prop.params.TZID ?? CALENDAR_TZ; // floating times use the calendar TZ
  const utc = tz === CALENDAR_TZ ? eventStartToUtc(naive) : wallToUtc(tz, +y, +mo, +d, +h, +mi, +s);
  return { allDay: false, naive, tz, utc };
}

const stamp = (dt) =>
  dt.allDay
    ? dt.date.replaceAll("-", "")
    : dt.utc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // Google instance-id style: 20260710T220000Z

// ---------- recurrence expansion (the subset Google Calendar emits) ----------
const BYDAY_NUM = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function expandRrule(rruleText, start, durationMs, exdates, overridden, warn) {
  const rule = Object.fromEntries(rruleText.split(";").map((p) => p.split("=")));
  const freq = rule.FREQ;
  const interval = Math.max(1, +(rule.INTERVAL ?? 1));
  const count = rule.COUNT ? +rule.COUNT : null;
  const until = rule.UNTIL ? parseDt({ params: {}, value: rule.UNTIL })?.utc : null;
  const horizon = new Date(Date.now() + HORIZON_DAYS * 86400_000);
  const supported = ["FREQ", "INTERVAL", "COUNT", "UNTIL", "WKST", "BYDAY"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq) ||
      Object.keys(rule).some((k) => !supported.includes(k)) ||
      (rule.BYDAY && freq !== "WEEKLY") || start.allDay) {
    warn(`unsupported RRULE "${rruleText}" — keeping first occurrence only`);
    return [start];
  }

  // Step in local wall-clock space so each occurrence keeps its local time across DST.
  const [date, time] = start.naive
    ? [start.naive.slice(0, 10), start.naive.slice(11)]
    : [start.utc.toISOString().slice(0, 10), start.utc.toISOString().slice(11, 19)]; // Z-form series: step in UTC
  const inUtcSpace = !start.naive;
  const mk = (d) => {
    const naive = `${d}T${time}`;
    const utc = inUtcSpace ? new Date(`${naive}Z`)
      : start.tz && start.tz !== CALENDAR_TZ
        ? wallToUtc(start.tz, ...d.split("-").map(Number), ...time.split(":").map(Number))
        : eventStartToUtc(naive);
    return { allDay: false, naive, tz: start.tz, utc };
  };
  const addDays = (d, n) => {
    const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n);
    return t.toISOString().slice(0, 10);
  };
  const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();

  const out = [];
  const wanted = freq === "WEEKLY"
    ? (rule.BYDAY ?? "").split(",").filter(Boolean).map((x) => BYDAY_NUM[x]).filter((x) => x != null)
    : [];
  if (freq === "WEEKLY" && !wanted.length) wanted.push(dow(date));
  const wkst = BYDAY_NUM[rule.WKST ?? "MO"] ?? 1;
  const weekStart0 = addDays(date, -((dow(date) - wkst + 7) % 7));

  let d = date, made = 0;
  for (let guard = 0; guard < 20000; guard++) {
    let occ = null;
    if (freq === "WEEKLY") {
      const weeks = Math.round((+new Date(`${addDays(d, -((dow(d) - wkst + 7) % 7))}T00:00:00Z`) - +new Date(`${weekStart0}T00:00:00Z`)) / (7 * 86400_000));
      if (weeks % interval === 0 && wanted.includes(dow(d)) && d >= date) occ = mk(d);
      d = addDays(d, 1);
    } else if (freq === "DAILY") {
      occ = mk(d); d = addDays(d, interval);
    } else { // MONTHLY / YEARLY: same day-of-month (skip months without it)
      const [y, mo, dd] = d.split("-").map(Number);
      const cand = new Date(Date.UTC(y, mo - 1, dd));
      if (cand.getUTCDate() === dd) occ = mk(d);
      const next = freq === "MONTHLY" ? new Date(Date.UTC(y, mo - 1 + interval, dd)) : new Date(Date.UTC(y + interval, mo - 1, dd));
      d = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    if (!occ) continue;
    if (until && occ.utc > until) break;
    if (occ.utc > horizon) break;
    made++;
    if (!exdates.has(+occ.utc) && !overridden.has(+occ.utc)) out.push(occ);
    if (count && made >= count) break;
  }
  return out;
}

// ---------- feed → rows ----------
// "Centennial Park, 446 SW 9th St, Redmond, OR 97756, USA" → venue + address
function splitLocation(loc) {
  if (!loc) return { venue: null, address: null };
  const parts = unescapeText(loc).split(",").map((s) => s.trim()).filter(Boolean);
  while (parts.length && /^(usa|united states)$/i.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return { venue: null, address: null };
  if (/^\d/.test(parts[0])) return { venue: null, address: parts.join(", ") };
  return { venue: parts[0], address: parts.slice(1).join(", ") || null };
}

const warnings = [];
const warn = (m) => { warnings.push(m); console.log(`  ! ${m}`); };

const icsText = process.env.ICS_FILE
  ? readFileSync(process.env.ICS_FILE, "utf8")
  : await (async () => {
      const res = await fetch(ICS_URL);
      if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
      return res.text();
    })();

const vevents = parseIcs(icsText);
console.log(`Feed: ${vevents.length} VEVENTs (${process.env.ICS_FILE ?? "live"})`);

// First pass: collect RECURRENCE-ID overrides so series expansion can skip them.
const overriddenByUid = new Map(); // uid → Set<ms of original occurrence start>
for (const ev of vevents) {
  const rid = parseDt(ev.get("RECURRENCE-ID"));
  if (!rid) continue;
  const uid = (ev.get("UID")?.value ?? "").replace("@google.com", "").trim();
  if (!overriddenByUid.has(uid)) overriddenByUid.set(uid, new Set());
  overriddenByUid.get(uid).add(+rid.utc);
}

const now = new Date();
const occurrences = []; // { gcalId, row }
for (const ev of vevents) {
  const uid = (ev.get("UID")?.value ?? "").replace("@google.com", "").trim();
  const start = parseDt(ev.get("DTSTART"));
  if (!uid || !start) { warn(`skipping VEVENT with no UID/DTSTART (uid=${uid})`); continue; }
  const end = parseDt(ev.get("DTEND"));
  const durationMs = end && !start.allDay && !end.allDay ? +end.utc - +start.utc : null;
  const title = unescapeText(ev.get("SUMMARY")?.value ?? "").trim() || "(untitled)";
  const description = unescapeText(ev.get("DESCRIPTION")?.value ?? "") || null;
  const { venue, address } = splitLocation(ev.get("LOCATION")?.value);
  const cancelled = (ev.get("STATUS")?.value ?? "").toUpperCase() === "CANCELLED";
  const rid = parseDt(ev.get("RECURRENCE-ID"));
  const rrule = ev.get("RRULE")?.value;

  const exdates = new Set();
  for (const ex of ev.all("EXDATE"))
    for (const v of ex.value.split(","))
      { const p = parseDt({ params: ex.params, value: v }); if (p) exdates.add(+p.utc); }

  const starts = rrule
    ? expandRrule(rrule, start, durationMs, exdates, overriddenByUid.get(uid) ?? new Set(), warn)
    : [start];

  for (const s of starts) {
    // Google's instance-id convention: series/override occurrences get uid_<stamp>;
    // plain singles keep the bare uid (matches the ids Base44 stored).
    const gcalId = rrule ? `${uid}_${stamp(s)}` : rid ? `${uid}_${stamp(rid)}` : uid;
    occurrences.push({
      gcalId,
      title,
      row: {
        gcal_event_id: gcalId,
        title,
        description,
        start_at: s.utc.toISOString(),
        end_at: durationMs != null ? new Date(+s.utc + durationMs).toISOString() : null,
        venue_name: venue,
        address,
        status: cancelled ? "cancelled" : s.utc >= now ? "upcoming" : "past",
        approval_status: "approved", // the calendar is curated — entries arrive approved
        // image/category/tags/link_cta/lat/lng deliberately absent: inserts take
        // defaults, updates preserve anything added editorially in the app.
      },
    });
  }
}

// ---------- existing gcal-linked rows (for dedupe preference + vanish detection) ----------
const { data: existing, error: exErr } = await db
  .from("events")
  .select("id, gcal_event_id, title, start_at, status")
  .not("gcal_event_id", "is", null)
  .limit(5000);
if (exErr) throw new Error(`prefetch failed: ${exErr.message}`);
const existingIds = new Set(existing.map((e) => e.gcal_event_id));

// Collapse duplicate calendar entries (same title + same start): prefer the id
// already in the DB so history stays attached to the original row.
const byKey = new Map();
for (const o of occurrences) {
  const key = `${o.title.toLowerCase().replace(/\s+/g, " ")}|${o.row.start_at}`;
  const prev = byKey.get(key);
  if (!prev) { byKey.set(key, o); continue; }
  const keep = existingIds.has(prev.gcalId) ? prev
    : existingIds.has(o.gcalId) ? o
    : prev.gcalId < o.gcalId ? prev : o;
  const drop = keep === prev ? o : prev;
  byKey.set(key, keep);
  console.log(`  ~ duplicate calendar entry collapsed: "${o.title}" @ ${o.row.start_at} (kept ${keep.gcalId}, skipped ${drop.gcalId})`);
}
const rows = [...byKey.values()].map((o) => o.row);

const feedIds = new Set(rows.map((r) => r.gcal_event_id));
const inserts = rows.filter((r) => !existingIds.has(r.gcal_event_id));
const refreshes = rows.length - inserts.length;
const vanished = existing.filter(
  (e) => !feedIds.has(e.gcal_event_id) && new Date(e.start_at) > now,
);

console.log(`Plan: ${rows.length} occurrences → ${inserts.length} new, ${refreshes} refreshed, ${vanished.length} vanished future row(s) to delete`);
for (const r of inserts) console.log(`  + ${r.start_at.slice(0, 10)}  ${r.title}`);
for (const e of vanished) console.log(`  - ${e.start_at.slice(0, 10)}  ${e.title} (removed from calendar)`);

if (DRY) { console.log("DRY_RUN — no writes."); process.exit(0); }

// ---------- write ----------
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await db.from("events").upsert(rows.slice(i, i + 200), { onConflict: "gcal_event_id" });
  if (error) throw new Error(`upsert failed: ${error.message}`);
}
if (vanished.length) {
  const { error } = await db.from("events").delete().in("gcal_event_id", vanished.map((e) => e.gcal_event_id));
  if (error) throw new Error(`delete failed: ${error.message}`);
}

const { count } = await db.from("events").select("id", { count: "exact", head: true });
console.log(`Done. events table now has ${count} rows (${warnings.length} warning(s)).`);
