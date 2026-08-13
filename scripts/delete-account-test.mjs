// Failure-injection test for the account-deletion sequence (audit follow-up, 2026-08-13).
// Bundles supabase/functions/delete-account/deletion.ts with esbuild and runs the real
// orchestration with each step made to fail in turn — no Supabase, no network.
//   Usage:  node scripts/delete-account-test.mjs
//
// THE BUG THIS EXISTS TO CATCH: supabase-js resolves with `{ data, error }` instead of
// throwing, so the original sequence's first two `await`s discarded their errors and only
// the auth-user delete was checked. With the schema's FKs —
//   businesses.owner_id → auth.users ON DELETE SET NULL
//   profiles.id         → auth.users ON DELETE CASCADE
// — a silently failed listing-release followed by a successful auth-user delete left the
// listing with owner_id NULL but claimed TRUE: owned by nobody, and filtered out of the
// claim list, so unclaimable by anyone, forever, with nothing reporting it.
//
// The invariant every case below defends: NOTHING IRREVERSIBLE HAPPENS ON A PARTIAL STATE.
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(path.join(tmpdir(), "rc-del-"));
await build({
  entryPoints: [path.join(ROOT, "supabase/functions/delete-account/deletion.ts")],
  bundle: true, format: "esm", platform: "node",
  outfile: path.join(tmp, "deletion.mjs"), logLevel: "error",
});
const { runAccountDeletion } = await import(path.join(tmp, "deletion.mjs"));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); c ? pass++ : fail++; };

const UID = "u_test";

/**
 * A fake world with the REAL foreign-key behaviour modelled, so "what would the database
 * actually be left holding" is what gets asserted — not just what the function returned.
 */
function makeWorld({ failOn = null, releaseIsSilentNoop = false, countFails = false } = {}) {
  const world = {
    listings: [{ id: "b_1", owner_id: UID, claimed: true }],
    profiles: [{ id: UID }],
    authUsers: [{ id: UID }],
    calls: [],
  };
  const steps = {
    releaseListings: async (uid) => {
      world.calls.push("release");
      if (failOn === "release") return "connection reset";
      // The dangerous case: the call REPORTS success but changes nothing.
      if (!releaseIsSilentNoop) {
        for (const l of world.listings) if (l.owner_id === uid) { l.owner_id = null; l.claimed = false; }
      }
      return null;
    },
    countOwnedListings: async (uid) => {
      world.calls.push("count");
      if (countFails) return { count: 0, error: "permission denied" };
      return { count: world.listings.filter((l) => l.owner_id === uid).length, error: null };
    },
    deleteProfile: async (uid) => {
      world.calls.push("profile");
      if (failOn === "profile") return "deadlock detected";
      world.profiles = world.profiles.filter((p) => p.id !== uid);
      return null;
    },
    deleteAuthUser: async (uid) => {
      world.calls.push("auth");
      if (failOn === "auth") return "auth service unavailable";
      world.authUsers = world.authUsers.filter((u) => u.id !== uid);
      // Model the FKs: SET NULL on businesses.owner_id, CASCADE on profiles.
      for (const l of world.listings) if (l.owner_id === uid) l.owner_id = null; // claimed NOT touched
      world.profiles = world.profiles.filter((p) => p.id !== uid);
      return null;
    },
  };
  return { world, steps };
}

const orphans = (w) => w.listings.filter((l) => l.claimed && l.owner_id === null);

// ── happy path ───────────────────────────────────────────────────────────────────────────
{
  const { world, steps } = makeWorld();
  const r = await runAccountDeletion(UID, steps);
  ok(r.ok && r.accountDeleted, "happy path: account fully deleted");
  ok(r.completed.join(",") === "release-listings,delete-profile,delete-auth-user",
     `happy path: all three steps ran in order (${r.completed.join(" → ")})`);
  ok(world.authUsers.length === 0 && world.profiles.length === 0, "happy path: auth user and profile are gone");
  ok(world.listings[0].owner_id === null && world.listings[0].claimed === false,
     "happy path: listing survives as PUBLIC content, released and re-claimable");
  ok(orphans(world).length === 0, "happy path: no unclaimable orphan");
}

// ── failure at step 1: release listings ──────────────────────────────────────────────────
{
  const { world, steps } = makeWorld({ failOn: "release" });
  const r = await runAccountDeletion(UID, steps);
  ok(!r.ok && r.failedStep === "release-listings", `step 1 failure is reported (${r.failedStep})`);
  ok(!r.accountDeleted && world.authUsers.length === 1,
     "step 1 failure: the auth user is NOT deleted — nothing irreversible happened");
  ok(!world.calls.includes("auth"), "step 1 failure: the irreversible step was never even attempted");
  ok(r.resumable, "step 1 failure: reported as resumable (retry re-runs it)");
  ok(orphans(world).length === 0, "step 1 failure: no unclaimable orphan created");
}

// ── THE ORIGINAL BUG: step 1 reports success but silently changes nothing ────────────────
{
  const { world, steps } = makeWorld({ releaseIsSilentNoop: true });
  const r = await runAccountDeletion(UID, steps);
  ok(!r.ok && r.failedStep === "verify-release",
     `silent no-op release is CAUGHT by the verify guard (${r.failedStep})`);
  ok(/still owned/i.test(r.error ?? ""), `the error explains why we stopped: "${r.error?.slice(0, 60)}…"`);
  ok(world.authUsers.length === 1 && !world.calls.includes("auth"),
     "silent no-op: auth user untouched — the exact corruption path is blocked");
  ok(orphans(world).length === 0,
     "silent no-op: NO listing left claimed-by-nobody (this is the bug that used to ship)");
}

// ── the verify read itself failing must also stop the sequence ──────────────────────────
{
  const { world, steps } = makeWorld({ countFails: true });
  const r = await runAccountDeletion(UID, steps);
  ok(!r.ok && r.failedStep === "verify-release", "an unverifiable release also stops the sequence");
  ok(world.authUsers.length === 1, "unverifiable release: auth user untouched (fail closed, not open)");
}

// ── failure at step 2: delete profile ───────────────────────────────────────────────────
{
  const { world, steps } = makeWorld({ failOn: "profile" });
  const r = await runAccountDeletion(UID, steps);
  ok(!r.ok && r.failedStep === "delete-profile", `step 2 failure is reported (${r.failedStep})`);
  ok(world.authUsers.length === 1 && !world.calls.includes("auth"),
     "step 2 failure: auth user NOT deleted");
  ok(r.completed.includes("release-listings"),
     "step 2 failure: the resume state records that step 1 already succeeded");
  ok(world.listings[0].claimed === false,
     "step 2 failure: listings were still released, so a retry can't orphan them");
}

// ── failure at step 3: the irreversible one ─────────────────────────────────────────────
{
  const { world, steps } = makeWorld({ failOn: "auth" });
  const r = await runAccountDeletion(UID, steps);
  ok(!r.ok && r.failedStep === "delete-auth-user", `step 3 failure is reported (${r.failedStep})`);
  ok(r.resumable && !r.accountDeleted, "step 3 failure: resumable, and does not claim the account is deleted");
  ok(world.authUsers.length === 1, "step 3 failure: the user can still sign in and retry");
  ok(orphans(world).length === 0, "step 3 failure: no orphan (listings already released)");
}

// ── idempotence: retrying after each partial failure completes the job ───────────────────
for (const failOn of ["release", "profile", "auth"]) {
  const { world, steps } = makeWorld({ failOn });
  await runAccountDeletion(UID, steps);          // first attempt fails
  const healed = makeWorld();                     // same world shape, no injected failure
  healed.world.listings = world.listings;
  healed.world.profiles = world.profiles;
  healed.world.authUsers = world.authUsers;
  const r2 = await runAccountDeletion(UID, healed.steps);
  ok(r2.ok && r2.accountDeleted,
     `retry after a step-'${failOn}' failure completes the deletion (resume works)`);
  ok(orphans(healed.world).length === 0, `retry after '${failOn}': still no orphan`);
}

// ── guard rails ─────────────────────────────────────────────────────────────────────────
{
  const { steps } = makeWorld();
  const r = await runAccountDeletion("", steps);
  ok(!r.ok && !r.resumable, "an empty uid is rejected and is NOT reported as resumable");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
