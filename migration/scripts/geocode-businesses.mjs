// Geocode imported businesses (lat/lng were NULL from Base44 — IMPORT-REPORT follow-up #1).
// OSM Nominatim (free, 1 req/sec policy, proper User-Agent), CACHE-FIRST so results are
// geocoded once and applied to any DB (local + hosted) without re-hitting the API.
// Sanity: a hit must land within 50 mi of Redmond, OR — otherwise it's treated as a miss
// (never fling a business to another state). Idempotent: only rows with lat IS NULL.
//
// Usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node migration/scripts/geocode-businesses.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const ROOT = path.resolve(import.meta.dirname, "../..");
const CACHE_PATH = path.join(ROOT, "migration", "geocode-cache.json");
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const saveCache = () => writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

const CENTER = { lat: 44.2726, lng: -121.1739 }; // Redmond, OR
const MAX_MI = 50;
const UA = "RedmondCompass-migration/1.0 (gchism94@gmail.com)";

const milesFrom = (lat, lng) => {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat - CENTER.lat), dLng = rad(lng - CENTER.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(CENTER.lat)) * Math.cos(rad(lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

let lastReq = 0;
async function nominatim(q) {
  const wait = 1100 - (Date.now() - lastReq); // ≥1s between requests (usage policy)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": UA } },
  );
  if (!res.ok) return null;
  const [hit] = await res.json();
  if (!hit) return null;
  const lat = Number(hit.lat), lng = Number(hit.lon);
  return milesFrom(lat, lng) <= MAX_MI ? { lat, lng } : null;
}

// Query variants, most-specific first. Base44 addresses are e.g.
// "857 SW Rimrock Way, Redmond" / "5165 SW Clubhouse Rd., CRR" / "2414 S Hwy 97, Redmond".
function candidates(address) {
  const norm = address
    .trim()
    .replace(/\bCRR\b/gi, "Crooked River Ranch")            // local abbreviation
    .replace(/\b(S|N)\.?\s+(Hwy|Highway)\.?\s*97\b/gi, "Highway 97") // Nominatim knows US 97 without the S/N prefix
    .replace(/\bHwy\.?\b/gi, "Highway");
  const noUnit = norm.replace(/\s*(#|Suite|Ste\.?|Unit|Bldg\.?)\s*[\w-]+,?/gi, "").replace(/\s{2,}/g, " ").trim();
  const withState = (s) => (/\b(or|oregon)\b/i.test(s) ? s : `${s}, Oregon`);
  return [...new Set([withState(norm), withState(noUnit), `${noUnit.split(",")[0]}, Redmond, Oregon`])];
}

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error } = await db
  .from("businesses")
  .select("id, name, address")
  .is("lat", null)
  .neq("address", "");
if (error) throw new Error(error.message);
console.log(`${rows.length} businesses need geocoding (cache has ${Object.keys(cache).length} entries)`);

let ok = 0, miss = 0, fromCache = 0;
const misses = [];
for (const b of rows) {
  const key = b.address.trim().toLowerCase();
  let hit = cache[key];
  if (hit === null && process.env.RETRY_MISSES) hit = undefined; // heuristics improved → re-try misses
  if (hit === undefined) {
    hit = null;
    for (const q of candidates(b.address)) {
      hit = await nominatim(q);
      if (hit) break;
    }
    cache[key] = hit; // cache misses too (null) so re-runs don't re-query
    saveCache();
  } else if (hit !== null) fromCache++;
  if (hit) {
    const { error: upErr } = await db.from("businesses").update({ lat: hit.lat, lng: hit.lng }).eq("id", b.id);
    if (upErr) throw new Error(`${b.name}: ${upErr.message}`);
    ok++;
  } else {
    miss++;
    misses.push(`${b.name} — "${b.address}"`);
  }
}
console.log(`geocoded ${ok}/${rows.length} (${fromCache} from cache) · ${miss} unresolved`);
if (misses.length) console.log("unresolved:\n  " + misses.join("\n  "));
