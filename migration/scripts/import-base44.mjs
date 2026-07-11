// One-time Base44 → Supabase import (Stage 1, GAP-REPORT dispositions signed off by Greg).
// Idempotent (upsert on the Base44 id, which becomes the row id). Imports: businesses
// (incl. the 2 sheet-only rows + approved BusinessPhotos merged into photos[]), events
// (approval status + gcal_event_id kept; submitter emails deliberately NOT imported —
// they live in the archived snapshot), news, resources, business classes, community
// bulletins, community videos, and auth users (owner_email → owner_id linkage).
// Skips by disposition: BusinessAnalytics (archive-only), BusinessReview (empty),
// YardSale (0 records; table ready for the Phase 2 submit flow).
// The `featured` flag is dropped on purpose — equal ranking is structural.
// Fictional dev-seed rows (exact ids from src/data/mock/seed.ts) are purged first so
// the DB converges to real data; app-created rows are never touched.
//
// Usage:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node migration/scripts/import-base44.mjs [snapshot-date]
import { build } from "esbuild";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service key via env only).");
  process.exit(1);
}
const ROOT = path.resolve(import.meta.dirname, "../..");
const SNAP = path.join(ROOT, "migration", `base44-snapshot-${process.argv[2] ?? "2026-07-10"}`);
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const load = (e) => JSON.parse(readFileSync(path.join(SNAP, `${e}.json`), "utf8"));

// ---- bundle app utilities we must stay consistent with (DST-safe times, mock ids) ----
const tmp = mkdtempSync(path.join(tmpdir(), "rc-import-"));
async function bundle(entry, out) {
  await build({ entryPoints: [path.join(ROOT, entry)], bundle: true, format: "esm", platform: "node", outfile: path.join(tmp, out), logLevel: "error" });
  return import(path.join(tmp, out));
}
const { eventStartToUtc } = await bundle("src/lib/calendar.ts", "calendar.mjs");
const mock = await bundle("src/data/mock/seed.ts", "seed.mjs");

// ---- helpers ----
const slugify = (s) => (s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "listing");
const compact = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v != null && v !== "") r[k] = v; return Object.keys(r).length ? r : null; };
const TODAY = new Date().toISOString().slice(0, 10);

const CATEGORY_LABELS = {
  "food-drink": "Food & Drink", "bars-breweries": "Bars & Breweries", "entertainment": "Entertainment",
  "shopping": "Shopping", "home-services": "Home Services", "beauty-wellness": "Beauty & Wellness",
  "beauty-personal-care": "Beauty & Personal Care", "automotive": "Automotive", "sports-fitness": "Sports & Fitness",
  "education": "Education", "outdoors": "Outdoors", "pet-services": "Pet Services",
  "professionals": "Professionals", "community-markets": "Community & Markets",
  "community-organizations": "Community Organizations", "transportation": "Transportation", "lodging": "Lodging",
};
const catLabel = (c) => CATEGORY_LABELS[c] ?? (c ? c.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Other");

// "6:00 PM - 8:00 PM" → ["18:00","20:00"]; returns [] when unparseable.
function parseTimes(text) {
  if (!text) return [];
  const out = [];
  for (const m of text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi)) {
    let h = Number(m[1]) % 12;
    if (/p/i.test(m[3])) h += 12;
    out.push(`${String(h).padStart(2, "0")}:${m[2] ?? "00"}`);
    if (out.length === 2) break;
  }
  return out;
}

async function upsert(table, rows, label = table) {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${label}: ${error.message}`);
  console.log(`  ${label.padEnd(20)} ${rows.length} upserted`);
}

// ---- 0) purge fictional dev-seed rows (exact ids only — app-created rows untouched) ----
console.log("purging fictional dev-seed rows…");
const purges = [
  ["recommendations", null],
  ["bulletins", mock.bulletins.map((x) => x.id)],
  ["events", mock.events.map((x) => x.id)],
  ["news_articles", mock.news.map((x) => x.id)],
  ["resources", mock.resources.map((x) => x.id)],
  ["businesses", mock.businesses.map((x) => x.id)],
];
for (const [table, ids] of purges) {
  if (!ids) { // recommendations: only those pointing at fictional businesses
    await db.from("recommendations").delete().in("business_id", mock.businesses.map((x) => x.id));
    continue;
  }
  const { error } = await db.from(table).delete().in("id", ids);
  if (error) throw new Error(`purge ${table}: ${error.message}`);
}

// ---- 1) businesses (130 Base44 + 2 sheet-only), approved photos merged ----
const photosByBiz = {};
for (const p of load("BusinessPhoto")) {
  if (p.status !== "approved" || !p.image_url) continue;
  (photosByBiz[p.business_id] ??= []).push(p.image_url);
}
const seenSlugs = new Set();
const uniqueSlug = (name) => {
  let s = slugify(name), i = 2;
  while (seenSlugs.has(s)) s = `${slugify(name)}-${i++}`;
  seenSlugs.add(s);
  return s;
};
const toBizRow = (b, id) => ({
  id,
  name: b.name,
  slug: uniqueSlug(b.name),
  category: catLabel(b.category),
  extra_categories: (b.categories ?? []).filter((c) => c !== b.category).map(catLabel),
  subcategories: [...new Set([b.subcategory, ...(b.tags ?? [])].filter(Boolean))],
  description: b.description ?? "",
  long_description: b.long_description ?? null,
  address: b.address ?? "",
  phone: b.phone ?? null,
  website: b.website ?? null,
  email: b.email ?? null,
  message_link: b.message_link ?? null,
  hours: null,                       // Base44 hours are free text; structured hours come later
  hours_text: b.hours ?? null,
  photos: [b.image_url, ...(photosByBiz[b.id] ?? [])].filter(Boolean).slice(0, 5), // free cap
  amenity_tags: [],
  claimed: !!b.owner_email,          // owner linkage below
  verified: false,                   // Verified is earned in-app, not imported
  tier: "free",
  socials: compact({ facebook: b.facebook, instagram: b.instagram, tiktok: b.tiktok, youtube: b.youtube, linkedin: b.linkedin, twitter: b.twitter, pinterest: b.pinterest }),
  license_number: b.license_number ?? null,
  specials: b.specials ?? null,
  specials_image_url: b.specials_image_url ?? null,
  additional_locations: b.additional_locations?.length ? b.additional_locations : null,
  created_at: b.created_date ?? new Date().toISOString(),
  // NOTE: b.featured is intentionally dropped (equal ranking — no such column exists)
});
const businesses = load("Business");
const bizRows = businesses.map((b) => toBizRow(b, b.id));

// the 2 sheet-only businesses (GAP-REPORT §3b — approved for import)
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [head, ...rest] = rows;
  return rest.filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(head.map((h, j) => [h.trim(), r[j] ?? ""])));
}
const sheet = parseCsv(readFileSync(path.join(SNAP, "google-refs/sheet-tab1.csv"), "utf8"));
const bizNames = new Set(businesses.map((b) => b.name.trim().toLowerCase()));
const sheetOnly = sheet.filter((r) => r.Name && !bizNames.has(r.Name.trim().toLowerCase()));
for (const r of sheetOnly) {
  const kebab = (r.Category ?? "").trim().toLowerCase().replace(/\s*&\s*|\s+/g, "-");
  bizRows.push(
    toBizRow(
      {
        name: r.Name.trim(), category: kebab, subcategory: r.Subcategory || null,
        description: r.Description || "", long_description: r["Long Description"] || null,
        address: r.Address || "", phone: r.Phone || null, website: r.Website || null,
        email: r.Email || null, message_link: r["Message Link"] || null, hours: r.Hours || null,
        image_url: r["Image URL"] || null, owner_email: r["Owner Email"] || null,
        facebook: r.Facebook || null, instagram: r.Instagram || null, tiktok: r.TikTok || null,
        youtube: r.YouTube || null, linkedin: r.LinkedIn || null, twitter: r.Twitter || null,
        pinterest: r.Pinterest || null, license_number: r["License Number"] || null,
        specials: r.Specials || null, specials_image_url: r["Specials Image URL"] || null,
        tags: (r.Tags ?? "").split(/[,;]/).map((t) => t.trim()).filter(Boolean),
      },
      "b44s_" + createHash("sha256").update(r.Name.trim().toLowerCase()).digest("hex").slice(0, 20),
    ),
  );
}
console.log(`importing… (${bizRows.length} businesses = ${businesses.length} Base44 + ${sheetOnly.length} sheet-only)`);
await upsert("businesses", bizRows);

// ---- 2) auth users + owner linkage (re-auth via OTP/Google at first sign-in) ----
const users = load("User");
// owner_email grants may point at emails with NO Base44 account (admin-granted access);
// create those too so first sign-in lands them owning their business.
for (const b of businesses) {
  if (b.owner_email && !users.some((u) => u.email?.trim().toLowerCase() === b.owner_email.trim().toLowerCase())) {
    users.push({ email: b.owner_email, full_name: null });
  }
}
const { data: existing } = await db.auth.admin.listUsers();
const byEmail = new Map((existing?.users ?? []).map((u) => [u.email?.toLowerCase(), u.id]));
let createdUsers = 0;
for (const u of users) {
  const email = u.email?.trim().toLowerCase();
  if (!email || byEmail.has(email)) continue;
  const { data, error } = await db.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { name: u.full_name ?? email.split("@")[0] },
  });
  if (error) { console.log(`  user ${email}: ${error.message}`); continue; }
  byEmail.set(email, data.user.id);
  createdUsers++;
}
console.log(`  users                ${createdUsers} created (${users.length} in snapshot)`);
let ownerLinks = 0;
for (const b of businesses) {
  const uid = b.owner_email && byEmail.get(b.owner_email.trim().toLowerCase());
  if (!uid) continue;
  await db.from("businesses").update({ owner_id: uid, claimed: true }).eq("id", b.id);
  await db.from("profiles").upsert({ id: uid, owner_business_id: b.id }, { onConflict: "id" });
  ownerLinks++;
}
console.log(`  owner links          ${ownerLinks}`);

// ---- 3) events (approval + gcal kept; submitter emails NOT imported) ----
const evRows = load("Event").map((e) => {
  const [t0, t1] = parseTimes(e.time);
  const startNaive = `${e.date}T${t0 ?? "12:00"}:00`;
  return {
    id: e.id,
    business_id: null, // Base44 events are community-level; classes carry the business tie
    title: e.title,
    description: e.description ?? null,
    start_at: eventStartToUtc(startNaive).toISOString(),
    end_at: t1 ? eventStartToUtc(`${e.date}T${t1}:00`).toISOString() : null,
    venue_name: e.location ?? null,
    address: null, lat: null, lng: null,
    image: e.image_url ?? null,
    category: e.category ? e.category.replace(/\b\w/g, (m) => m.toUpperCase()) : null,
    tags: [],
    link_cta: e.link ? { label: "More info", url: e.link } : null,
    status: (e.date ?? "") >= TODAY ? "upcoming" : "past",
    approval_status: e.status === "pending" ? "pending" : "approved",
    submitter_name: e.submitter_name ?? null,
    gcal_event_id: e.gcal_event_id || null,
  };
});
await upsert("events", evRows);
const noTime = load("Event").filter((e) => parseTimes(e.time).length === 0).length;

// ---- 4) news ----
const newsSlugs = new Set();
await upsert("news_articles", load("NewsPost").map((n) => {
  let s = slugify(n.title), i = 2;
  while (newsSlugs.has(s)) s = `${slugify(n.title)}-${i++}`;
  newsSlugs.add(s);
  return {
    id: n.id, title: n.title, slug: s,
    excerpt: n.summary ?? "", body: n.body ?? "",
    image: n.image_url ?? null,
    source: n.source_name || "Redmond Compass", author: null,
    published_at: n.published_date || n.created_date,
    category: n.category ?? null, pinned: !!n.pinned, source_url: n.source_url || null,
  };
}));

// ---- 5) resources ----
await upsert("resources", load("Resource").map((r) => ({
  id: r.id, name: r.title, category: r.category,
  subcategory: r.subcategory ?? null,
  description: r.description ?? "",
  phone: r.phone ?? null, url: r.website ?? null, address: r.address ?? null,
  email: r.email ?? null,
  additional_phones: r.additional_phones?.length ? r.additional_phones : null,
  service_times: r.service_times ?? null,
  image_url: r.image_url ?? null,
  facebook: r.facebook ?? null, instagram: r.instagram ?? null,
})));

// ---- 6) business classes / community bulletins / community videos ----
await upsert("business_classes", load("BusinessClass").map((c) => ({
  id: c.id, business_id: c.business_id, title: c.title,
  date: c.date?.slice(0, 10), time_text: c.time ?? null,
  location: c.location ?? null, description: c.description ?? null,
  link: c.link ?? null, image_url: c.image_url ?? null,
  status: c.status ?? "open", created_at: c.created_date,
})));
await upsert("community_bulletins", load("Bulletin").map((b) => ({
  id: b.id, title: b.title, body: b.body, image_url: b.image_url ?? null,
  support_link: b.support_link ?? null, support_label: b.support_label ?? null,
  pinned: !!b.pinned, category: b.category ?? "other", created_at: b.created_date,
})));
await upsert("community_videos", load("CommunityVideo").map((v) => ({
  id: v.id, title: v.title, description: v.description ?? null,
  youtube_url: v.youtube_url, category: v.category ?? null,
  source_name: v.source_name ?? null, is_default: !!v.featured, created_at: v.created_date,
})));

// ---- verify ----
console.log("\nfinal counts:");
for (const t of ["businesses", "events", "news_articles", "resources", "business_classes", "community_bulletins", "community_videos", "bulletins", "yard_sales"]) {
  const { count } = await db.from(t).select("id", { count: "exact", head: true });
  console.log(`  ${t.padEnd(20)} ${count}`);
}
console.log(`\nnotes: ${noTime} events had unparseable/missing times (imported at 12:00 PT, flagged in IMPORT-REPORT).`);
console.log("skipped by disposition: BusinessAnalytics (archive-only), BusinessReview (empty), YardSale (0 records).");
