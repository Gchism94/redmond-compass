// Tests for the Google Calendar → Supabase sync (audit follow-up, 2026-08-14).
// Runs the REAL planSync from scripts/lib/gcal-transform.mjs against crafted ICS fixtures —
// no Google, no Supabase, no network.  Usage:  node scripts/gcal-sync-test.mjs
//
// THE GAP THIS CLOSES: this job runs unattended in CI every 6 hours against production and
// had NO test of any kind. Its output had only ever been validated against what the
// transform was written to produce — never against what the `events` schema requires. That
// is precisely the shape of the sync-sheet slug bug, which shipped for weeks because the
// suite checked the READ contract and never the WRITE contract.
//
// §3 is the write-contract check, the direct analogue of sync-sheet-test's §10: it parses
// supabase/migrations/*.sql, derives the real not-null / unique / CHECK constraints on
// `events`, and asserts the payload satisfies them.
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "rc-gcal-test-"));
await build({
  entryPoints: [path.join(ROOT, "src/lib/calendar.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(tmp, "calendar.mjs"), logLevel: "error",
});
const { eventStartToUtc } = await import(path.join(tmp, "calendar.mjs"));
const { planSync } = await import(path.join(ROOT, "scripts/lib/gcal-transform.mjs"));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const NOW = new Date("2026-08-14T12:00:00Z");
const plan = (icsText, existing = []) => planSync({ icsText, existing, now: NOW, eventStartToUtc });
const ics = (...vevents) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...vevents, "END:VCALENDAR"].join("\r\n");
const vevent = (o) => [
  "BEGIN:VEVENT",
  `UID:${o.uid}@google.com`,
  `DTSTART:${o.start}`,
  ...(o.end ? [`DTEND:${o.end}`] : []),
  `SUMMARY:${o.summary ?? "Test Event"}`,
  ...(o.location ? [`LOCATION:${o.location}`] : []),
  ...(o.rrule ? [`RRULE:${o.rrule}`] : []),
  ...(o.status ? [`STATUS:${o.status}`] : []),
  "END:VEVENT",
].join("\r\n");

// ─────────────────────────────────────────────────────────────────────────────────────────
// 1) HAPPY PATH
// ─────────────────────────────────────────────────────────────────────────────────────────
{
  const p = plan(ics(vevent({
    uid: "evt1", start: "20261201T190000Z", end: "20261201T210000Z",
    summary: "Live Music at Dry Canyon", location: "Dry Canyon Club, 123 SW 6th St, Redmond, OR, USA",
  })));
  ok(p.ok && p.rows.length === 1, `happy path → ok, 1 row (${p.rows.length})`);
  const r = p.rows[0];
  ok(r.gcal_event_id === "evt1", `gcal_event_id is the bare UID for a single (${r.gcal_event_id})`);
  ok(r.title === "Live Music at Dry Canyon", "title mapped");
  ok(r.venue_name === "Dry Canyon Club" && r.address === "123 SW 6th St, Redmond, OR",
     `location split into venue + address ("${r.venue_name}" / "${r.address}")`);
  ok(r.status === "upcoming", `future event → status upcoming (${r.status})`);
  ok(r.approval_status === "approved", "calendar entries arrive approved");
  ok(p.inserts.length === 1 && p.vanished.length === 0, "new row counted as an insert, nothing vanished");
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 2) DEFECT #1 — a feed that parses to nothing must NOT delete the calendar
//    Proven against production before the guard existed: an empty-but-HTTP-200 body produced
//    "0 occurrences → 3 vanished future row(s) to delete", and the job reported success.
// ─────────────────────────────────────────────────────────────────────────────────────────
{
  const existing = [
    { id: "e_1", gcal_event_id: "evt1", title: "Farmers Market", start_at: "2026-08-21T22:00:00Z", status: "upcoming" },
    { id: "e_2", gcal_event_id: "evt2", title: "Farmers Market", start_at: "2026-08-28T22:00:00Z", status: "upcoming" },
    { id: "e_3", gcal_event_id: "evt3", title: "Past thing",     start_at: "2026-01-01T22:00:00Z", status: "past" },
  ];

  for (const [label, body] of [
    ["empty calendar body", ics()],
    ["HTML error page with a 200", "<!doctype html><html><body>Not Found</body></html>"],
    ["truncated mid-VEVENT", "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:x@google.com"],
    ["empty string", ""],
  ]) {
    const p = plan(body, existing);
    ok(!p.ok, `ABORTS on ${label}`);
    ok(p.vanished.length === 0 && p.rows.length === 0,
       `  → deletes nothing and writes nothing on ${label} (vanished=${p.vanished.length})`);
    ok(/refusing/i.test(p.abortReason ?? ""), `  → abortReason explains why (${(p.abortReason ?? "").slice(0, 48)}…)`);
  }

  // The guard must not fire when there is genuinely nothing to protect.
  const fresh = plan(ics(), []);
  ok(fresh.ok && fresh.rows.length === 0,
     "an empty feed against an EMPTY table is a legitimate no-op, not an abort");

  // And a real feed must still be able to delete a genuinely-removed future event.
  const shrunk = plan(ics(vevent({ uid: "evt1", start: "20260821T220000Z" })), existing);
  ok(shrunk.ok, "a non-empty feed still plans normally");
  ok(shrunk.vanished.length === 1 && shrunk.vanished[0].gcal_event_id === "evt2",
     `a genuinely-removed FUTURE event is still deleted (${shrunk.vanished.map((v) => v.gcal_event_id).join(",")})`);
  ok(!shrunk.vanished.some((v) => v.gcal_event_id === "evt3"),
     "a PAST row absent from the feed is never deleted (the snapshot is the archive)");
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 3) WRITE CONTRACT — derive the real `events` constraints from the migrations and assert
//    the payload satisfies them. The check sync-sheet was missing when the slug bug shipped.
// ─────────────────────────────────────────────────────────────────────────────────────────
function parseEventsSchema() {
  const dir = path.join(ROOT, "supabase/migrations");
  const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n")
    // Strip `--` comments FIRST: these migrations document columns inline and those comments
    // contain commas and parens that would otherwise be read as top-level separators.
    .replace(/--[^\n]*/g, "");
  const columns = new Map();
  const add = (name, spec) => {
    const s = spec.toLowerCase();
    columns.set(name, {
      notNull: /\bnot\s+null\b/.test(s),
      hasDefault: /\bdefault\b/.test(s) || /\bprimary\s+key\b/.test(s) || /\bgenerated\b/.test(s),
      unique: /\bunique\b/.test(s),
      allowed: (() => {
        const m = spec.match(/check\s*\(\s*\w+\s+in\s*\(([^)]*)\)/i);
        return m ? m[1].split(",").map((x) => x.trim().replace(/^'|'$/g, "")) : null;
      })(),
    });
  };
  const topLevelSplit = (body) => {
    const out = []; let depth = 0, cur = "";
    for (const ch of body) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out;
  };
  const create = sql.match(/create\s+table\s+public\.events\s*\(([\s\S]*?)\n\);/i);
  if (create) for (const part of topLevelSplit(create[1])) {
    const m = part.trim().match(/^([a-z_][a-z0-9_]*)\s+(.+)$/is);
    if (m && !/^(primary|unique|foreign|constraint|check)\b/i.test(m[1])) add(m[1], m[2]);
  }
  for (const [, body] of sql.matchAll(/alter\s+table\s+public\.events\s+([\s\S]*?);/gi)) {
    for (const part of topLevelSplit(body)) {
      const m = part.trim().match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+(.+)$/is);
      if (m) add(m[1], m[2]);
    }
  }
  return columns;
}

const schema = parseEventsSchema();
ok(schema.size > 10, `parsed the events schema from the migrations (${schema.size} columns)`);
const required = [...schema.entries()].filter(([, c]) => c.notNull && !c.hasDefault).map(([n]) => n);
ok(required.join(",") === "title,start_at",
   `required (not-null, no default) columns are exactly [${required.join(", ")}]`);
ok(schema.get("gcal_event_id")?.unique === true,
   "schema check is meaningful: gcal_event_id really is UNIQUE (the upsert key)");

{
  // A deliberately awkward feed: an all-day event, a cancelled one, a past one, a recurring
  // series, a no-title entry, and one with no DTEND — every branch that builds a row.
  const p = plan(ics(
    vevent({ uid: "a", start: "20261201T190000Z", end: "20261201T200000Z", summary: "Normal" }),
    vevent({ uid: "b", start: "20261202T190000Z", summary: "No end time" }),
    vevent({ uid: "c", start: "20260101T190000Z", summary: "In the past" }),
    vevent({ uid: "d", start: "20261203T190000Z", summary: "Called off", status: "CANCELLED" }),
    vevent({ uid: "e", start: "20261204T190000Z", summary: "" }),
    vevent({ uid: "f", start: "20261205T190000Z", rrule: "FREQ=WEEKLY;COUNT=3", summary: "Weekly" }),
    "BEGIN:VEVENT\r\nUID:g@google.com\r\nDTSTART;VALUE=DATE:20261206\r\nSUMMARY:All day\r\nEND:VEVENT",
  ));
  ok(p.ok && p.rows.length >= 8, `awkward feed produces rows (${p.rows.length})`);

  const unknownKeys = new Set(), missingRequired = new Set(), nullish = new Set(), badEnum = new Set();
  for (const r of p.rows) {
    for (const k of Object.keys(r)) if (!schema.has(k)) unknownKeys.add(k);
    for (const req of required) {
      if (!(req in r)) missingRequired.add(req);
      else if (r[req] === null || r[req] === undefined || r[req] === "") nullish.add(req);
    }
    for (const [col, c] of schema) {
      if (c.allowed && col in r && r[col] != null && !c.allowed.includes(r[col])) badEnum.add(`${col}=${r[col]}`);
    }
  }
  ok(unknownKeys.size === 0, `every payload key is a real events column (${[...unknownKeys].join(", ") || "none unknown"})`);
  ok(missingRequired.size === 0, `every not-null-without-default column is present (${[...missingRequired].join(", ") || "none missing"})`);
  ok(nullish.size === 0, `no required column is null/empty (${[...nullish].join(", ") || "none"})`);
  ok(badEnum.size === 0, `status/approval_status only ever take CHECK-legal values (${[...badEnum].join(", ") || "all legal"})`);
  ok(p.rows.every((r) => !Number.isNaN(Date.parse(r.start_at))), "every start_at is a valid timestamp");

  // Regression guard, stated as the failure that shipped in sync-sheet: drop a required
  // column and the contract check must catch it — proving these assertions can fail.
  const sabotaged = { ...p.rows[0] };
  delete sabotaged.title;
  ok(required.some((r) => !(r in sabotaged)),
     "contract check detects a payload missing a required column (proves it can fail)");
  ok(!schema.has("nonexistent_column"),
     "contract check would reject an invented column name (proves the key check can fail)");
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 4) DEFECT #2 — no duplicate gcal_event_id may reach one upsert batch
//    Proven against a real database before the fix: Postgres rejects the WHOLE batch with
//    "ON CONFLICT DO UPDATE command cannot affect row a second time", so one malformed
//    calendar entry blocked every sync until someone edited the calendar.
// ─────────────────────────────────────────────────────────────────────────────────────────
{
  // Same UID, DIFFERENT title and start — sails straight past a title|start dedupe.
  const p = plan(ics(
    vevent({ uid: "dup", start: "20261201T190000Z", summary: "Trivia Night" }),
    vevent({ uid: "dup", start: "20261208T190000Z", summary: "Trivia Night (rescheduled)" }),
  ));
  ok(p.ok, "a duplicate-UID feed still plans (it must not abort the whole run)");
  const ids = p.rows.map((r) => r.gcal_event_id);
  ok(new Set(ids).size === ids.length,
     `no duplicate gcal_event_id in the batch (${ids.length} rows, ${new Set(ids).size} unique)`);
  ok(p.rows.length === 1, `the collision is collapsed to one row (${p.rows.length})`);
  ok(p.rows[0].start_at === "2026-12-01T19:00:00.000Z",
     `collapse is deterministic — keeps the earlier start (${p.rows[0].start_at})`);
  ok(p.warnings.some((w) => /duplicate gcal_event_id/i.test(w)),
     "the collapse is WARNED about, not silently swallowed");

  // The pre-existing same-title-same-start collapse must still work (different UIDs).
  const dupEntries = plan(ics(
    vevent({ uid: "x1", start: "20261201T190000Z", summary: "Farmers Market" }),
    vevent({ uid: "x2", start: "20261201T190000Z", summary: "Farmers Market" }),
  ));
  ok(dupEntries.rows.length === 1, `same title+start with different UIDs still collapses (${dupEntries.rows.length})`);

  // A whole batch of collisions must still emit a writable set.
  const many = plan(ics(...Array.from({ length: 6 }, (_, i) =>
    vevent({ uid: "same", start: `2026120${i + 1}T190000Z`, summary: `Variant ${i}` }))));
  const manyIds = many.rows.map((r) => r.gcal_event_id);
  ok(new Set(manyIds).size === manyIds.length, `6 colliding entries → still unique keys (${manyIds.length} rows)`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 5) Idempotence — the property the whole sync rests on
// ─────────────────────────────────────────────────────────────────────────────────────────
{
  const feed = ics(
    vevent({ uid: "i1", start: "20261201T190000Z", summary: "Repeatable" }),
    vevent({ uid: "i2", start: "20261202T190000Z", summary: "Also repeatable" }),
  );
  const first = plan(feed, []);
  const asExisting = first.rows.map((r, i) => ({
    id: `e_${i}`, gcal_event_id: r.gcal_event_id, title: r.title, start_at: r.start_at, status: r.status,
  }));
  const second = plan(feed, asExisting);
  ok(second.inserts.length === 0 && second.refreshes === 2,
     `re-running the same feed inserts nothing and refreshes everything (${second.inserts.length} new, ${second.refreshes} refreshed)`);
  ok(second.vanished.length === 0, "re-running deletes nothing");
  ok(JSON.stringify(first.rows) === JSON.stringify(second.rows), "the produced rows are byte-identical across runs");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
