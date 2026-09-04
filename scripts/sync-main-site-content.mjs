#!/usr/bin/env node
// One-way approved Redmond Compass content → app database mirror. The public site owns
// intake and moderation; this process never writes back to the source.

import { build } from "esbuild";
import { createClient } from "@supabase/supabase-js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const buildDir = await mkdtemp(path.join(tmpdir(), "redmond-content-sync-"));
const plannerPath = path.join(buildDir, "planner.mjs");
await build({
  entryPoints: [path.resolve("scripts/lib/main-site-content-sync.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: plannerPath,
  logLevel: "silent",
});
const { MAIN_SITE_CONTENT_URLS, MAIN_SITE_SOURCE, buildMainSiteContentPlan } = await import(pathToFileURL(plannerPath).href);

const fetchJson = async (label, url) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "RedmondCompassContentBridge/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`main-site ${label} request failed (${response.status})`);
  return response.json();
};

const readAll = async (queryFactory, label) => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory().range(from, from + 999);
    if (error) throw new Error(`could not read ${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const upsertBatches = async (db, table, rows) => {
  for (let start = 0; start < rows.length; start += 200) {
    const { error } = await db.from(table).upsert(rows.slice(start, start + 200), { onConflict: "id" });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
};

const deleteBatches = async (db, table, ids) => {
  for (let start = 0; start < ids.length; start += 200) {
    const { error } = await db.from(table).delete().in("id", ids.slice(start, start + 200)).eq("source", MAIN_SITE_SOURCE);
    if (error) throw new Error(`${table} mirror cleanup failed: ${error.message}`);
  }
};

try {
  const [eventFeed, postFeed, classFeed] = await Promise.all([
    fetchJson("events", MAIN_SITE_CONTENT_URLS.events),
    fetchJson("business posts", MAIN_SITE_CONTENT_URLS.posts),
    fetchJson("business classes", MAIN_SITE_CONTENT_URLS.classes),
  ]);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const [businesses, existingEvents, existingPosts, existingClasses] = await Promise.all([
    readAll(() => db.from("businesses").select("id").order("id"), "business ids"),
    readAll(() => db.from("events").select("id,title,start_at,gcal_event_id,source,source_id").order("id"), "events"),
    readAll(() => db.from("bulletins").select("id,source_id").eq("source", MAIN_SITE_SOURCE).order("id"), "mirrored posts"),
    readAll(() => db.from("business_classes").select("id,source_id").eq("source", MAIN_SITE_SOURCE).order("id"), "mirrored classes"),
  ]);
  const plan = buildMainSiteContentPlan({
    events: eventFeed,
    posts: postFeed,
    classes: classFeed,
    businessIds: businesses.map((row) => row.id),
    existingEvents,
    existingPosts,
    existingClasses,
  });
  const summary = {
    ok: true,
    dryRun: DRY_RUN,
    source: "redmondcompass.com public entities",
    rowsRead: plan.rowsRead,
    upserts: { events: plan.events.length, posts: plan.posts.length, classes: plan.classes.length },
    deletes: { events: plan.deleteEventIds.length, posts: plan.deletePostIds.length, classes: plan.deleteClassIds.length },
    skipped: plan.skipped,
  };
  if (DRY_RUN) {
    console.log(JSON.stringify({ ...summary, wrote: false }, null, 2));
    process.exitCode = 0;
  } else {
    const { data: started, error: startError } = await db.from("sync_runs")
      .insert({ status: "running", trigger: "main_site_content" }).select("id").single();
    if (startError) throw new Error(`could not start sync log: ${startError.message}`);
    try {
      await upsertBatches(db, "events", plan.events);
      await upsertBatches(db, "bulletins", plan.posts);
      await upsertBatches(db, "business_classes", plan.classes);
      await deleteBatches(db, "events", plan.deleteEventIds);
      await deleteBatches(db, "bulletins", plan.deletePostIds);
      await deleteBatches(db, "business_classes", plan.deleteClassIds);
      const upserted = plan.events.length + plan.posts.length + plan.classes.length;
      const deleted = plan.deleteEventIds.length + plan.deletePostIds.length + plan.deleteClassIds.length;
      await db.from("sync_runs").update({
        finished_at: new Date().toISOString(),
        status: plan.skipped.length ? "partial" : "success",
        rows_read: plan.rowsRead,
        rows_upserted: upserted,
        rows_unpublished: deleted,
        rows_skipped: plan.skipped.length,
        message: `source=redmondcompass.com; events=${plan.events.length}; posts=${plan.posts.length}; classes=${plan.classes.length}; removed=${deleted}`,
        errors: plan.skipped,
      }).eq("id", started.id);
      console.log(JSON.stringify({ ...summary, wrote: true }, null, 2));
    } catch (error) {
      await db.from("sync_runs").update({
        finished_at: new Date().toISOString(), status: "error",
        message: error instanceof Error ? error.message : String(error),
      }).eq("id", started.id);
      throw error;
    }
  }
} finally {
  await rm(buildDir, { recursive: true, force: true });
}
