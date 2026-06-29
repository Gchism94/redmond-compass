// Seed ONLY News + Resources into a Supabase project (editorial/civic content that is
// Supabase-native — correct to ship). Deliberately does NOT seed businesses/bulletins/
// events: those are dev mock data, and the real source for businesses is the deferred
// GoHighLevel sync — seeding them on hosted would enshrine mock rows as production data to
// later reconcile against GHL. Idempotent (upsert on id). Reuses the mock seed for content.
//
// Usage (service_role stays in the shell, never committed/printed):
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   node scripts/seed-hosted.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (service_role; not VITE_, never committed).");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const tmp = path.join(mkdtempSync(path.join(tmpdir(), "rc-seedhosted-")), "seed.mjs");
await build({ entryPoints: [path.join(root, "src/data/mock/seed.ts")], bundle: true, format: "esm", platform: "node", outfile: tmp, logLevel: "error" });
const { news, resources } = await import(tmp);

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const newsRows = news.map((n) => ({
  id: n.id, title: n.title, slug: n.slug, excerpt: n.excerpt, body: n.body,
  image: n.image ?? null, source: n.source, author: n.author ?? null, published_at: n.publishedAt,
}));
const resourceRows = resources.map((r) => ({
  id: r.id, name: r.name, category: r.category, description: r.description,
  phone: r.phone ?? null, url: r.url ?? null, address: r.address ?? null,
}));

const a = await db.from("news_articles").upsert(newsRows, { onConflict: "id" }).select("id");
if (a.error) throw new Error(`news: ${a.error.message}`);
const b = await db.from("resources").upsert(resourceRows, { onConflict: "id" }).select("id");
if (b.error) throw new Error(`resources: ${b.error.message}`);
console.log(`seeded → news_articles=${a.data.length}  resources=${b.data.length}`);

// Confirm the GHL-owned tables stay EMPTY on hosted (awaiting sync).
const counts = {};
for (const t of ["businesses", "bulletins", "events", "news_articles", "resources"]) {
  const { count } = await db.from(t).select("id", { count: "exact", head: true });
  counts[t] = count ?? 0;
}
console.log(`hosted row counts: ${JSON.stringify(counts)}`);
const emptyOk = counts.businesses === 0 && counts.bulletins === 0 && counts.events === 0;
console.log(emptyOk ? "OK: businesses/bulletins/events empty (awaiting GHL sync)" : "WARN: GHL-owned tables are NOT empty");
process.exit(emptyOk ? 0 : 1);
