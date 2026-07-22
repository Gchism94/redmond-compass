// sync-sheet — scheduled pull: Google Sheet → Supabase `businesses`.
//
// The Google Sheet is the source of truth for directory data (GHL is out of the
// path). This function reads it via the Google Sheets API using a service account
// (NOT the public "publish to web" CSV), validates the header row, upserts on the
// sheet's `id`, soft-unpublishes rows that left the sheet, logs the run to
// `sync_runs`, and — if anything changed — fires the host deploy hook (debounced).
//
// SAFETY (see sheet-sync-spec §3): header/empty-sheet/auth failures ABORT with the
// previous data intact; row-level failures skip-and-log; nothing is ever
// hard-deleted; ordering stays neutral (no ranking/boost field is written).
//
// Secrets (set with `supabase secrets set`, never in the repo or the sheet):
//   SHEET_ID                 the spreadsheet id
//   SHEET_RANGE              e.g. "Businesses!A:Z" (default)
//   GOOGLE_SERVICE_ACCOUNT   the SA key JSON (has client_email + private_key)
//   DEPLOY_HOOK_URL          host build hook (optional; skipped if unset)
//   SYNC_SECRET              optional shared secret for the manual/apps-script trigger
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy:  supabase functions deploy sync-sheet
// Schedule (every 15 min) via pg_cron — see supabase/functions/sync-sheet/schedule.sql
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { buildSyncPlan } from "./transform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHEET_ID = Deno.env.get("SHEET_ID") ?? "";
const SHEET_RANGE = Deno.env.get("SHEET_RANGE") ?? "Businesses!A:Z";
const DEPLOY_HOOK_URL = Deno.env.get("DEPLOY_HOOK_URL") ?? "";
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";
const DEPLOY_DEBOUNCE_MIN = 60;

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// ---- Google service-account access token (RS256 JWT → OAuth token) ----
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}
async function getGoogleAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT") ?? "{}");
  if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT missing client_email/private_key");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)),
  );
  const jwt = `${header}.${claims}.${b64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${json.error ?? res.status} ${json.error_description ?? ""}`);
  return json.access_token as string;
}

async function fetchSheetValues(token: string): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`Sheets API error: ${json.error?.message ?? res.status}`);
  return (json.values ?? []) as string[][];
}

async function maybeFireDeployHook(changed: boolean): Promise<boolean> {
  if (!changed || !DEPLOY_HOOK_URL) return false;
  const since = new Date(Date.now() - DEPLOY_DEBOUNCE_MIN * 60_000).toISOString();
  const { data: recent } = await db
    .from("sync_runs")
    .select("id")
    .eq("deploy_fired", true)
    .gte("finished_at", since)
    .limit(1);
  if (recent && recent.length) return false; // debounced — a build already fired this hour
  try {
    await fetch(DEPLOY_HOOK_URL, { method: "POST" });
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  // Optional shared-secret gate for manual / apps-script triggers.
  const trigger = new URL(req.url).searchParams.get("trigger") ?? "schedule";
  if (SYNC_SECRET) {
    const provided = req.headers.get("x-sync-secret") ?? "";
    if (provided !== SYNC_SECRET) return new Response("forbidden", { status: 403 });
  }

  const run = { rows_read: 0, rows_upserted: 0, rows_unpublished: 0, rows_skipped: 0 };
  const { data: started } = await db
    .from("sync_runs")
    .insert({ status: "running", trigger })
    .select("id")
    .single();
  const runId = started?.id;

  const finish = async (patch: Record<string, unknown>) => {
    if (runId) await db.from("sync_runs").update({ finished_at: new Date().toISOString(), ...patch }).eq("id", runId);
  };

  try {
    if (!SHEET_ID) throw new Error("SHEET_ID not configured");
    const token = await getGoogleAccessToken();
    const values = await fetchSheetValues(token);
    const plan = buildSyncPlan(values, SUPABASE_URL, new Date().toISOString());
    run.rows_read = Math.max(0, values.length - 1);

    // Run-level abort: header/empty-sheet drift — leave existing data untouched.
    if (!plan.ok) {
      await finish({ status: "aborted", message: plan.abortReason, rows_read: run.rows_read });
      return Response.json({ ok: false, aborted: plan.abortReason }, { status: 200 });
    }

    // Upsert in batches (keyed on the sheet's id = businesses.id).
    for (let i = 0; i < plan.upserts.length; i += 200) {
      const batch = plan.upserts.slice(i, i + 200);
      const { error } = await db.from("businesses").upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`upsert failed: ${error.message}`);
      run.rows_upserted += batch.length;
    }

    // Soft-unpublish: rows the sync has touched before (synced_at not null) that are
    // no longer in the sheet. Owner-created / pre-sync rows (synced_at null) are never
    // auto-unpublished. NEVER a hard delete.
    let unpublished = 0;
    if (plan.sheetIds.length) {
      const { data: gone } = await db
        .from("businesses")
        .select("id")
        .not("synced_at", "is", null)
        .eq("published", true)
        .not("id", "in", `(${plan.sheetIds.map((id) => `"${id}"`).join(",")})`);
      const ids = (gone ?? []).map((r: { id: string }) => r.id);
      if (ids.length) {
        const { error } = await db
          .from("businesses")
          .update({ published: false, synced_at: new Date().toISOString() })
          .in("id", ids);
        if (!error) unpublished = ids.length;
      }
    }
    run.rows_unpublished = unpublished;
    run.rows_skipped = plan.skipped.length;

    const changed = run.rows_upserted > 0 || run.rows_unpublished > 0;
    const deployFired = await maybeFireDeployHook(changed);

    await finish({
      status: plan.skipped.length ? "partial" : "success",
      ...run,
      deploy_fired: deployFired,
      message: [...plan.headerWarnings, `${plan.warnings.length} warning(s)`].join(" · "),
      errors: [...plan.skipped, ...plan.warnings],
    });
    return Response.json({ ok: true, ...run, deployFired });
  } catch (e) {
    await finish({ status: "error", message: String(e instanceof Error ? e.message : e), ...run });
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
