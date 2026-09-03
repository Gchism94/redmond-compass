#!/usr/bin/env node
// Temporary one-way bridge while redmondcompass.com still authors automated news in
// Base44. Public NewsPost rows are upserted by their stable Base44 id; nothing is deleted.
// Existing slugs are preserved so shared /news/... links do not move.

import { createClient } from "@supabase/supabase-js";
import { buildNewsSyncPlan, newsFeedUrl } from "./lib/base44-news-sync.mjs";
import { enrichNewsImages } from "./lib/news-image-enrichment.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.REDMOND_MAIN_SITE_URL;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const response = await fetch(newsFeedUrl(SITE_URL), {
  headers: { Accept: "application/json", "User-Agent": "RedmondCompassNewsBridge/1.0" },
  signal: AbortSignal.timeout(30_000),
});
if (!response.ok) throw new Error(`main-site news request failed (${response.status})`);
const upstream = await response.json();

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: existing, error: readError } = await db.from("news_articles").select("id,slug,image");
if (readError) throw new Error(`could not read existing news: ${readError.message}`);

const plan = buildNewsSyncPlan(upstream, existing ?? []);
if (!plan.ok) throw new Error(plan.abortReason);

const imagePlan = await enrichNewsImages(plan.rows, {
  limit: Number.parseInt(process.env.NEWS_IMAGE_ENRICH_LIMIT ?? "12", 10),
});
plan.rows = imagePlan.rows;

for (let start = 0; start < plan.rows.length; start += 100) {
  const batch = plan.rows.slice(start, start + 100);
  const { error } = await db.from("news_articles").upsert(batch, { onConflict: "id" });
  if (error) throw new Error(`news upsert failed: ${error.message}`);
}

console.log(JSON.stringify({
  ok: true,
  upstreamRows: upstream.length,
  upserted: plan.rows.length,
  skipped: plan.skipped,
  warnings: plan.warnings,
  imagesEnriched: imagePlan.enriched,
  imagesUnresolved: imagePlan.unresolved,
  archivePolicy: "preserved; this bridge never deletes",
}));
