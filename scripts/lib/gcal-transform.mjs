// Pure feed→rows logic for the Google Calendar sync. NO network and NO Supabase client, so
// the exact same code that runs unattended in CI every 6 hours also runs under test with
// crafted ICS fixtures — the same split sync-sheet uses (transform.ts vs index.ts).
//
// `eventStartToUtc` is INJECTED rather than imported: it lives in src/lib/calendar.ts (TS),
// and keeping this module dependency-free means a test can bundle it once and hand it in.
//
// WHY THIS WAS EXTRACTED (audit follow-up, 2026-08-14). All of this was previously top-level
// side-effecting code in sync-gcal-events.mjs — it fetched and wrote on import, so none of it
// could be tested. Two defects had gone unnoticed as a direct result; both are guarded here
// and both have a test that fails without the guard. See ABORT and the gcal_event_id dedupe.

const BYDAY_NUM = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export const unescapeText = (s) =>
  s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();

/** Wall-clock → UTC for any IANA zone (used when an event carries a non-calendar TZID). */
export function wallToUtc(tz, y, mo, d, h, mi, s) {
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

export function parseIcs(text) {
  const unfolded = String(text ?? "").replace(/\r?\n[ \t]/g, ""); // RFC 5545 line unfolding
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
  return events.map((props) => ({
    get: (n) => props.find((p) => p.name === n),
    all: (n) => props.filter((p) => p.name === n),
  }));
}

export function makeParseDt({ eventStartToUtc, calendarTz }) {
  return function parseDt(prop) {
    if (!prop) return null;
    const v = prop.value.trim();
    if (prop.params.VALUE === "DATE" || /^\d{8}$/.test(v)) {
      const date = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
      return { allDay: true, date, utc: eventStartToUtc(`${date}T12:00:00`) }; // noon-local (matches import)
    }
    const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s, z] = m;
    const naive = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
    if (z === "Z") return { allDay: false, naive: null, utc: new Date(`${naive}Z`) };
    const tz = prop.params.TZID ?? calendarTz; // floating times use the calendar TZ
    const utc = tz === calendarTz ? eventStartToUtc(naive) : wallToUtc(tz, +y, +mo, +d, +h, +mi, +s);
    return { allDay: false, naive, tz, utc };
  };
}

export const stamp = (dt) =>
  dt.allDay
    ? dt.date.replaceAll("-", "")
    : dt.utc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // 20260710T220000Z

export function expandRrule(rruleText, start, exdates, overridden, warn, ctx) {
  const { eventStartToUtc, calendarTz, horizonDays, now, parseDt } = ctx;
  const rule = Object.fromEntries(rruleText.split(";").map((p) => p.split("=")));
  const freq = rule.FREQ;
  const interval = Math.max(1, +(rule.INTERVAL ?? 1));
  const count = rule.COUNT ? +rule.COUNT : null;
  const until = rule.UNTIL ? parseDt({ params: {}, value: rule.UNTIL })?.utc : null;
  const horizon = new Date(+now + horizonDays * 86400_000);
  const supported = ["FREQ", "INTERVAL", "COUNT", "UNTIL", "WKST", "BYDAY"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq) ||
      Object.keys(rule).some((k) => !supported.includes(k)) ||
      (rule.BYDAY && freq !== "WEEKLY") || start.allDay) {
    warn(`unsupported RRULE "${rruleText}" — keeping first occurrence only`);
    return [start];
  }

  const [date, time] = start.naive
    ? [start.naive.slice(0, 10), start.naive.slice(11)]
    : [start.utc.toISOString().slice(0, 10), start.utc.toISOString().slice(11, 19)];
  const inUtcSpace = !start.naive;
  const mk = (d) => {
    const naive = `${d}T${time}`;
    const utc = inUtcSpace ? new Date(`${naive}Z`)
      : start.tz && start.tz !== calendarTz
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
    } else {
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

/** "Centennial Park, 446 SW 9th St, Redmond, OR 97756, USA" → venue + address */
export function splitLocation(loc) {
  if (!loc) return { venue: null, address: null };
  const parts = unescapeText(loc).split(",").map((s) => s.trim()).filter(Boolean);
  while (parts.length && /^(usa|united states)$/i.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return { venue: null, address: null };
  if (/^\d/.test(parts[0])) return { venue: null, address: parts.join(", ") };
  return { venue: parts[0], address: parts.slice(1).join(", ") || null };
}

/**
 * Turn a raw ICS feed + the DB's current gcal-linked rows into a write plan.
 *
 * Returns { ok, abortReason?, rows, inserts, refreshes, vanished, warnings, collapsed }.
 * `ok: false` means the caller MUST NOT write anything — same contract as sync-sheet's
 * buildSyncPlan.
 */
export function planSync({
  icsText,
  existing = [],
  now = new Date(),
  eventStartToUtc,
  calendarTz = "America/Los_Angeles",
  horizonDays = 400,
}) {
  const warnings = [];
  const collapsed = [];
  const warn = (m) => warnings.push(m);
  const parseDt = makeParseDt({ eventStartToUtc, calendarTz });
  const ctx = { eventStartToUtc, calendarTz, horizonDays, now, parseDt };
  const vevents = parseIcs(icsText);
  const empty = { rows: [], inserts: [], refreshes: 0, vanished: [], warnings, collapsed, veventCount: vevents.length };

  // ── ABORT: the feed parsed to nothing while the DB holds calendar-linked rows ─────────
  // The fetch only checks res.ok, so a 200 carrying an empty ICS, an HTML error page or a
  // truncated body parses to ZERO VEVENTs. Without this guard every future gcal-linked row
  // then looks "removed from the calendar" and is DELETED — silently, with the job
  // reporting success. sync-sheet aborts on exactly this shape ("Sheet has a header but no
  // data rows — aborting to protect existing data"); this is the same guard.
  //
  // Deliberately conditional on `existing.length`: a genuinely empty calendar against an
  // empty table is a legitimate no-op, not an error.
  if (vevents.length === 0 && existing.length > 0) {
    return {
      ...empty,
      ok: false,
      abortReason:
        `Feed parsed to 0 VEVENTs but the database holds ${existing.length} calendar-linked ` +
        `event(s) — refusing to treat that as "everything was deleted from the calendar". ` +
        `Most likely the ICS fetch returned a non-ICS body (HTML error page, truncation) ` +
        `with a 200. Existing data left untouched.`,
    };
  }

  const overriddenByUid = new Map();
  for (const ev of vevents) {
    const rid = parseDt(ev.get("RECURRENCE-ID"));
    if (!rid) continue;
    const uid = (ev.get("UID")?.value ?? "").replace("@google.com", "").trim();
    if (!overriddenByUid.has(uid)) overriddenByUid.set(uid, new Set());
    overriddenByUid.get(uid).add(+rid.utc);
  }

  const occurrences = [];
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
      ? expandRrule(rrule, start, exdates, overriddenByUid.get(uid) ?? new Set(), warn, ctx)
      : [start];

    for (const s of starts) {
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
        },
      });
    }
  }

  const existingIds = new Set(existing.map((e) => e.gcal_event_id));

  // Pass 1 — collapse genuine duplicate calendar ENTRIES (same title + same start, different
  // UIDs). Greg's calendar has a few; preferring the id already in the DB keeps history
  // attached to the original row.
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
    collapsed.push(`duplicate calendar entry "${o.title}" @ ${o.row.start_at} (kept ${keep.gcalId}, skipped ${drop.gcalId})`);
  }

  // Pass 2 — the INVARIANT the upsert actually requires: no gcal_event_id twice in a batch.
  // Pass 1 keys on title|start, so two VEVENTs sharing a UID with DIFFERENT titles or starts
  // sail straight through it and collide, and Postgres rejects the whole batch with
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" — one malformed calendar
  // entry blocking every sync until someone edits the calendar. Pass 1 is kept because it
  // handles a different problem (same event, different UIDs); this enforces the key.
  const byGcalId = new Map();
  for (const o of byKey.values()) {
    const prev = byGcalId.get(o.gcalId);
    if (!prev) { byGcalId.set(o.gcalId, o); continue; }
    // Deterministic: keep the earlier start, so a rerun picks the same winner.
    const keep = prev.row.start_at <= o.row.start_at ? prev : o;
    const drop = keep === prev ? o : prev;
    byGcalId.set(o.gcalId, keep);
    const msg = `duplicate gcal_event_id "${o.gcalId}" in one batch — kept "${keep.title}" @ ${keep.row.start_at}, skipped "${drop.title}" @ ${drop.row.start_at}`;
    collapsed.push(msg);
    warn(msg);
  }

  const rows = [...byGcalId.values()].map((o) => o.row);
  const feedIds = new Set(rows.map((r) => r.gcal_event_id));
  const inserts = rows.filter((r) => !existingIds.has(r.gcal_event_id));
  const vanished = existing.filter((e) => !feedIds.has(e.gcal_event_id) && new Date(e.start_at) > now);

  return { ok: true, rows, inserts, refreshes: rows.length - inserts.length, vanished, warnings, collapsed, veventCount: vevents.length };
}
