// Pure orchestration for account deletion. NO Deno APIs and no Supabase client here, so
// the exact same sequence runs in the edge function AND under Node in
// scripts/delete-account-test.mjs with failure injected at each step (same split as
// sync-sheet's transform.ts).
//
// WHY THIS EXISTS (audit follow-up, 2026-08-13). The original inline sequence was:
//
//     await admin.from("businesses").update({ owner_id: null, claimed: false }).eq(…);
//     await admin.from("profiles").delete().eq("id", uid);
//     const { error } = await admin.auth.admin.deleteUser(uid);
//
// supabase-js does NOT throw on a failed query — it RESOLVES with `{ data, error }`. So the
// first two awaits discarded their errors entirely and only the third was checked. Combined
// with the schema's foreign keys that produces silent, permanent corruption:
//
//   businesses.owner_id → auth.users ON DELETE SET NULL
//   profiles.id         → auth.users ON DELETE CASCADE
//
// If releasing the listings failed and the auth-user delete then succeeded, `owner_id` was
// nulled by the FK but `claimed` stayed TRUE — a listing owned by nobody. ClaimScreen only
// offers `claimed = false` rows, so that listing could never be claimed by anyone again, and
// nothing anywhere reported it.
//
// The ordering (irreversible step last) was already right. What was missing was checking
// each step, and refusing to take the irreversible step until the recoverable ones are
// VERIFIED done.

export type StepName = "release-listings" | "delete-profile" | "delete-auth-user";

/** Each step reports failure by returning a message; `null` means it succeeded. */
export interface DeletionSteps {
  /** businesses.owner_id → null, claimed → false, for every listing this user owns. */
  releaseListings: (uid: string) => Promise<string | null>;
  /** How many listings still point at this user. The guard before the point of no return. */
  countOwnedListings: (uid: string) => Promise<{ count: number; error: string | null }>;
  /** Delete the personal profile row. */
  deleteProfile: (uid: string) => Promise<string | null>;
  /** IRREVERSIBLE. Deletes the auth user; FKs then cascade/null the rest. */
  deleteAuthUser: (uid: string) => Promise<string | null>;
}

export interface DeletionResult {
  ok: boolean;
  /** Steps that completed, in order — the resume state. */
  completed: StepName[];
  failedStep?: StepName | "verify-release";
  error?: string;
  /**
   * Whether simply calling delete-account again will finish the job. True for every failure
   * mode here: each step is idempotent (update-where, delete-where, deleteUser), so a retry
   * re-runs the completed steps as no-ops and resumes at the one that failed.
   */
  resumable: boolean;
  /**
   * True only when the account is fully gone. When false, NOTHING irreversible has happened
   * — the guard below guarantees we never reach the auth-user delete on a partial state.
   */
  accountDeleted: boolean;
}

/**
 * Run the deletion in strict order, checking every step, and refusing to cross the point of
 * no return unless the recoverable work is verified complete.
 *
 * Order is deliberate and load-bearing: everything reversible happens first, the
 * irreversible auth-user delete happens last, and a failure anywhere before it leaves an
 * account that still works and can be deleted again.
 */
export async function runAccountDeletion(uid: string, steps: DeletionSteps): Promise<DeletionResult> {
  const completed: StepName[] = [];
  const fail = (
    failedStep: DeletionResult["failedStep"],
    error: string,
  ): DeletionResult => ({ ok: false, completed, failedStep, error, resumable: true, accountDeleted: false });

  if (!uid) return { ...fail("release-listings", "no user id"), resumable: false };

  // 1) Release owned listings. The LISTING is public content and stays; only the personal
  //    ownership link goes.
  const releaseErr = await steps.releaseListings(uid);
  if (releaseErr) return fail("release-listings", `could not release owned listings: ${releaseErr}`);
  completed.push("release-listings");

  // 1b) VERIFY it actually took effect. This is the guard that makes the whole sequence
  //     safe: a silent no-op here used to become an unclaimable listing the moment step 3
  //     ran. If anything still points at this user — or we cannot even confirm — we stop
  //     while the account is still intact and retryable.
  const owned = await steps.countOwnedListings(uid);
  if (owned.error) return fail("verify-release", `could not verify listing release: ${owned.error}`);
  if (owned.count > 0) {
    return fail(
      "verify-release",
      `${owned.count} listing(s) still owned after release — refusing to delete the auth user, ` +
        "which would leave them claimed by nobody and unclaimable by anyone.",
    );
  }

  // 2) Delete the personal profile row. (profiles.id cascades from auth.users anyway, so
  //    this is belt-and-braces — but an error here still signals something is wrong with
  //    our database access, and we should not proceed on that.)
  const profileErr = await steps.deleteProfile(uid);
  if (profileErr) return fail("delete-profile", `could not delete profile: ${profileErr}`);
  completed.push("delete-profile");

  // 3) POINT OF NO RETURN.
  const authErr = await steps.deleteAuthUser(uid);
  if (authErr) {
    // Steps 1–2 already succeeded, so the user is left signed-in-able with no profile and no
    // owned listings. Retrying completes it: 1 and 2 are no-ops, 3 runs again.
    return fail("delete-auth-user", `could not delete the auth user: ${authErr}`);
  }
  completed.push("delete-auth-user");

  return { ok: true, completed, resumable: false, accountDeleted: true };
}
