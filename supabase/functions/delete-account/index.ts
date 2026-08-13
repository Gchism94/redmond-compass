// delete-account — the user-initiated account deletion behind Account → Delete
// account (privacy-policy dependency, sheet-sync-spec §4).
//
// Verifies the caller from their own JWT, then with the service role:
//   1. releases any business they own (owner_id → null, claimed → false) — the
//      LISTING is public content and stays; only the personal ownership link goes.
//      (Events carry no user link, so there is nothing else to anonymize.)
//   2. deletes their profile row (also cascades from the auth user).
//   3. deletes the auth user.
// The 30-day email fallback to RedmondCompass@gmail.com stays for anyone who can't
// use the in-app flow. Nothing here is reversible — the UI double-confirms first.
//
// Deploy:  supabase functions deploy delete-account   (no external secrets needed)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { runAccountDeletion, type DeletionSteps } from "./deletion.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "missing bearer token" }, 401);

  // Verify the caller against their own JWT (never trust a body-supplied id).
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid session" }, 401);
  const uid = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Each step reports failure by RETURNING a message. supabase-js resolves with
  // `{ data, error }` rather than throwing, which is exactly how the original version lost
  // the first two steps' errors — so every call here reads `.error` explicitly.
  const steps: DeletionSteps = {
    releaseListings: async (id) => {
      const { error } = await admin.from("businesses").update({ owner_id: null, claimed: false }).eq("owner_id", id);
      return error?.message ?? null;
    },
    countOwnedListings: async (id) => {
      const { count, error } = await admin
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", id);
      return { count: count ?? 0, error: error?.message ?? null };
    },
    deleteProfile: async (id) => {
      const { error } = await admin.from("profiles").delete().eq("id", id);
      return error?.message ?? null;
    },
    deleteAuthUser: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      return error?.message ?? null;
    },
  };

  try {
    const result = await runAccountDeletion(uid, steps);
    if (result.ok) {
      console.log(`delete-account: completed for ${uid} [${result.completed.join(" → ")}]`);
      return json({ ok: true });
    }
    // Log the resume state so a half-finished deletion is visible rather than silent.
    console.error(
      `delete-account: FAILED at ${result.failedStep} for ${uid} — completed [${result.completed.join(", ") || "none"}]; ` +
        `accountDeleted=${result.accountDeleted} resumable=${result.resumable}: ${result.error}`,
    );
    return json(
      { error: result.error, failedStep: result.failedStep, resumable: result.resumable, accountDeleted: result.accountDeleted },
      500,
    );
  } catch (e) {
    // An unexpected throw (network, client bug) — the account is untouched or partially
    // processed, and never irreversibly so, because the guard sits before that step.
    console.error(`delete-account: unexpected error for ${uid}:`, e);
    return json({ error: String(e instanceof Error ? e.message : e), resumable: true, accountDeleted: false }, 500);
  }
});
