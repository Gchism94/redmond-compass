/**
 * Turning a thrown write error into something a business owner can act on.
 *
 * Before this (audit 2026-08-13), all five owner mutations were bare
 * `await x.mutateAsync(...)` with no catch: on failure the button simply re-enabled and
 * nothing happened. The owner had no way to tell "you're offline" from "your session
 * expired" from "you don't own this listing" — three problems with three different fixes.
 *
 * Kept free of React and i18n imports so it stays unit-testable.
 */
import type { DictKey } from "@/i18n/dict";

export type MutationErrorKind =
  | "network" // offline / request never landed — retrying later works
  | "session" // JWT expired or missing — must sign in again
  | "permission" // RLS said no — not this user's row
  | "conflict" // unique violation, e.g. a slug or a duplicate claim
  | "unknown";

export interface ClassifiedError {
  kind: MutationErrorKind;
  /** Headline i18n key. */
  key: DictKey;
  /**
   * A message from the server worth showing verbatim. Only ever set for Postgres RAISE
   * (P0001) messages, which this codebase writes FOR humans ("Sign in to claim a
   * listing") — never a raw driver string, which would be noise to an owner.
   */
  serverMessage?: string;
  /** The fix is to sign in again — the caller should offer that, not just a retry. */
  needsAuth: boolean;
}

/** Best-effort field read off an unknown thrown value. */
function field(err: unknown, name: string): string {
  if (err && typeof err === "object" && name in err) {
    const v = (err as Record<string, unknown>)[name];
    if (typeof v === "string") return v;
  }
  return "";
}

export function classifyMutationError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : field(err, "message") || String(err ?? "");
  const code = field(err, "code");
  const m = message.toLowerCase();

  // Offline / request never reached the server. Checked FIRST: a dropped connection can
  // surface as almost any downstream symptom, and "check your connection" is always the
  // most useful thing to say when the browser already knows it's offline.
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline || m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return { kind: "network", key: "error.mutNetwork", needsAuth: false };
  }

  // Expired / missing session. PGRST301 = JWT invalid or expired.
  if (code === "PGRST301" || m.includes("jwt expired") || m.includes("invalid claim") || m.includes("not authenticated")) {
    return { kind: "session", key: "error.mutSession", needsAuth: true };
  }

  // Postgres RAISE from our own functions (e.g. claim_business's "Sign in to claim a
  // listing"). These are authored for humans, so show them as-is.
  if (code === "P0001") {
    const needsAuth = m.includes("sign in");
    return {
      kind: needsAuth ? "session" : "permission",
      key: needsAuth ? "error.mutSession" : "error.mutPermission",
      serverMessage: message,
      needsAuth,
    };
  }

  // 42501 = insufficient privilege; PostgREST phrases an RLS refusal this way too.
  if (code === "42501" || m.includes("row-level security") || m.includes("violates row-level")) {
    return { kind: "permission", key: "error.mutPermission", needsAuth: false };
  }

  if (code === "23505" || m.includes("duplicate key")) {
    return { kind: "conflict", key: "error.mutConflict", needsAuth: false };
  }

  return { kind: "unknown", key: "error.mutUnknown", needsAuth: false };
}
