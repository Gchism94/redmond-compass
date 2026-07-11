// Full Base44 export — Stage 1 migration, Phase 0 (insurance + diff; NOT a source of truth).
// Pages through every entity via the REST data port and writes dated raw JSON + a manifest,
// then downloads every referenced media file (Base44-hosted URLs die when Base44 is canceled).
//
// Usage:  BASE44_API_KEY=<key> node migration/scripts/base44-snapshot.mjs [YYYY-MM-DD]
// The API key comes from the environment ONLY — never commit it to any file.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const APP_ID = process.env.BASE44_APP_ID ?? "6a05e41957c8ee753cb7380c";
const KEY = process.env.BASE44_API_KEY;
if (!KEY) {
  console.error("Set BASE44_API_KEY in the environment (never commit it).");
  process.exit(1);
}
const BASE = `https://app.base44.com/api/apps/${APP_ID}/entities`;
const DATE = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const ROOT = path.resolve(import.meta.dirname, "../..");
const DIR = path.join(ROOT, "migration", `base44-snapshot-${DATE}`);
mkdirSync(path.join(DIR, "media"), { recursive: true });

// Every entity exposed by the data ports doc (order: content first, then meta).
const ENTITIES = [
  "Business", "Event", "NewsPost", "Resource", "Bulletin", "BusinessPost",
  "BusinessClass", "BusinessReview", "BusinessPhoto", "CommunityVideo",
  "YardSale", "BusinessAnalytics", "User",
];

const PAGE = 200;
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

async function fetchAll(entity) {
  const out = [];
  for (let skip = 0; ; skip += PAGE) {
    const res = await fetch(`${BASE}/${entity}?limit=${PAGE}&skip=${skip}&sort_by=created_date`, {
      headers: { api_key: KEY },
    });
    if (!res.ok) throw new Error(`${entity}: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`${entity}: unexpected payload ${JSON.stringify(rows).slice(0, 120)}`);
    out.push(...rows);
    if (rows.length < PAGE) break;
    await new Promise((r) => setTimeout(r, 250)); // be polite to the API
  }
  return out;
}

// ---- 1) entities ----
const manifest = { appId: APP_ID, capturedAt: new Date().toISOString(), entities: {}, media: {} };
for (const entity of ENTITIES) {
  const rows = await fetchAll(entity);
  const json = JSON.stringify(rows, null, 2);
  writeFileSync(path.join(DIR, `${entity}.json`), json);
  manifest.entities[entity] = { count: rows.length, sha256: sha256(json) };
  console.log(`${entity.padEnd(18)} ${String(rows.length).padStart(5)} records`);
}

// ---- 2) referenced media (image-ish fields only — social/website links are not media) ----
const MEDIA_FIELD = /image|photo|gallery|logo/i;
const urls = new Set();
for (const entity of ENTITIES) {
  const rows = JSON.parse(
    (await import("node:fs")).readFileSync(path.join(DIR, `${entity}.json`), "utf8"),
  );
  const walk = (val, keyName) => {
    if (typeof val === "string") {
      if (MEDIA_FIELD.test(keyName ?? "") && /^https?:\/\//.test(val)) urls.add(val);
    } else if (Array.isArray(val)) val.forEach((v) => walk(v, keyName));
    else if (val && typeof val === "object")
      Object.entries(val).forEach(([k, v]) => walk(v, k));
  };
  rows.forEach((r) => walk(r, ""));
}

let ok = 0, failed = [];
const extOf = (u) => (u.split("?")[0].match(/\.(png|jpe?g|webp|gif|svg|avif|heic)$/i)?.[0] ?? ".bin");
const mediaMap = {};
for (const url of urls) {
  const file = `${sha256(url).slice(0, 16)}${extOf(url)}`;
  const dest = path.join(DIR, "media", file);
  try {
    if (!existsSync(dest)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
    mediaMap[url] = `media/${file}`;
    ok++;
  } catch (e) {
    failed.push({ url, error: String(e.message ?? e) });
  }
}
manifest.media = { referenced: urls.size, downloaded: ok, failed };
writeFileSync(path.join(DIR, "media-map.json"), JSON.stringify(mediaMap, null, 2));
writeFileSync(path.join(DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nmedia: ${ok}/${urls.size} downloaded${failed.length ? ` (${failed.length} FAILED — see manifest.json)` : ""}`);
console.log(`snapshot → ${DIR}`);
