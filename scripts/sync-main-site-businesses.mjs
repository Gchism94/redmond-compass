#!/usr/bin/env node
// One-way main-site public directory → Supabase bridge. The main site currently receives
// approved GHL submissions before the legacy Google Sheet does, so this keeps the app's
// business list and hours aligned with what Redmond Compass actually publishes.

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

// Bundle the TypeScript planner because it shares the exact parser used by the Deno sheet
// function. This avoids a second hours parser drifting out of sync.
const buildDir = await mkdtemp(path.join(tmpdir(), "redmond-business-sync-"));
const plannerPath = path.join(buildDir, "planner.mjs");
await build({
  entryPoints: [path.resolve("scripts/lib/main-site-business-sync.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: plannerPath,
  logLevel: "silent",
});
const { MAIN_SITE_BUSINESS_URL, buildMainSiteBusinessPlan } = await import(pathToFileURL(plannerPath).href);

try {
  const response = await fetch(MAIN_SITE_BUSINESS_URL, {
    headers: { Accept: "application/json", "User-Agent": "RedmondCompassBusinessBridge/1.0" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`main-site business request failed (${response.status})`);
  const upstream = await response.json();

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existingRows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("businesses")
      .select("id,name,slug,published,synced_at,hours,owner_id")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`could not read existing businesses: ${error.message}`);
    existingRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const existing = {
    slugById: Object.fromEntries(existingRows.map((row) => [row.id, row.slug])),
    publishedById: Object.fromEntries(existingRows.map((row) => [row.id, !!row.published])),
    syncedById: Object.fromEntries(existingRows.map((row) => [row.id, row.synced_at != null])),
    ownerHoursById: Object.fromEntries(
      existingRows.map((row) => [row.id, !!row.owner_id && !!row.hours && typeof row.hours === "object"]),
    ),
  };
  const owners = existingRows
    .filter((row) => !!row.owner_id)
    .map((row) => ({ id: row.id, name: row.name }));
  const { plan, summary, groupByKeySet, ownerNameCollisions, sourceNameCollisions } = buildMainSiteBusinessPlan(
    upstream,
    SUPABASE_URL,
    new Date().toISOString(),
    existing,
    undefined,
    owners,
  );
  if (!plan.ok) throw new Error(plan.abortReason);

  const upstreamIds = new Set(plan.sheetIds);
  const wouldUnpublish = existingRows
    .filter((row) => row.published && row.synced_at != null && !row.owner_id && !upstreamIds.has(row.id))
    .map((row) => row.id);
  const missingHours = plan.upserts
    .filter((row) => !row.hours && !row.hours_text)
    .map((row) => ({ id: row.id, name: row.name }));
  const output = {
    ok: true,
    dryRun: DRY_RUN,
    source: "redmondcompass.com/listBusinessesPublic",
    ownerNameCollisions,
    sourceNameCollisions,
    ...summary,
    wouldSoftUnpublish: { count: wouldUnpublish.length, sample: wouldUnpublish.slice(0, 10) },
    missingHours: { count: missingHours.length, rows: missingHours },
  };
  if (DRY_RUN) {
    console.log(JSON.stringify({ ...output, wrote: false }, null, 2));
    process.exitCode = 0;
  } else {
    const { data: started, error: startError } = await db
      .from("sync_runs")
      .insert({ status: "running", trigger: "main_site" })
      .select("id")
      .single();
    if (startError) throw new Error(`could not start sync log: ${startError.message}`);

    try {
      let rowsUpserted = 0;
      for (const group of groupByKeySet(plan.upserts)) {
        for (let start = 0; start < group.length; start += 200) {
          const batch = group.slice(start, start + 200);
          const { error } = await db.from("businesses").upsert(batch, { onConflict: "id" });
          if (error) throw new Error(`business upsert failed: ${error.message}`);
          rowsUpserted += batch.length;
        }
      }
      let rowsUnpublished = 0;
      if (wouldUnpublish.length) {
        const { error } = await db
          .from("businesses")
          .update({ published: false, synced_at: new Date().toISOString() })
          .in("id", wouldUnpublish);
        if (error) throw new Error(`soft-unpublish failed: ${error.message}`);
        rowsUnpublished = wouldUnpublish.length;
      }
      await db.from("sync_runs").update({
        finished_at: new Date().toISOString(),
        status: plan.skipped.length ? "partial" : "success",
        rows_read: plan.sheetIds.length,
        rows_upserted: rowsUpserted,
        rows_unpublished: rowsUnpublished,
        rows_skipped: plan.skipped.length,
        message: `source=redmondcompass.com; parsed_hours=${plan.hoursParsed}; prose_hours=${plan.hoursUnparsed}; missing_hours=${plan.sheetIds.length - plan.hoursTextRows}`,
        errors: [...plan.skipped, ...plan.warnings],
      }).eq("id", started.id);
      console.log(JSON.stringify({ ...output, wrote: true, rowsUpserted, rowsUnpublished }, null, 2));
    } catch (error) {
      await db.from("sync_runs").update({
        finished_at: new Date().toISOString(),
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      }).eq("id", started.id);
      throw error;
    }
  }
} finally {
  await rm(buildDir, { recursive: true, force: true });
}
