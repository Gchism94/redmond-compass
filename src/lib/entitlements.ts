/**
 * Redmond Compass — entitlements (BUILD-BRIEF.md §6).
 * Single source of truth in code for what each tier unlocks. The product matrix
 * lives in redmond-compass-build-reference.html (§02); this encodes it.
 *
 * MVP ships only the Free set (every business is tier "free"), but the matrix is
 * complete so Member/Pro become a config flip — no rebuild.
 *
 * Hard rules that never change (enforce in the UI, not just here):
 *  - Free listings are COMPLETE, not crippled.
 *  - A capped action never destroys work (a capped bulletin can schedule free for reset).
 *  - Lapse is graceful: revert to free, data intact, listing live.
 *  - No paid placement. No star ratings. Reputation is positive-only.
 */
import type { Tier } from "./types";

export type Feature =
  | "enhancedProfile" // story, menu, gallery, CTAs
  | "unlimitedBulletins"
  | "scheduledBulletins"
  | "fullAnalytics"
  | "demandSignals"
  | "followerAnnouncements"
  | "followerPerks"
  | "teamAccess"
  | "bookings" // Pro tool (B7)
  | "inquiryInbox" // Pro tool (B8) — also private-feedback routing
  | "loyalty"; // Pro tool (B9)

const FREE: Feature[] = [];

const MEMBER: Feature[] = [
  "enhancedProfile",
  "unlimitedBulletins",
  "scheduledBulletins",
  "fullAnalytics",
  "demandSignals",
  "followerAnnouncements",
  "followerPerks",
  "teamAccess",
];

const PRO: Feature[] = [...MEMBER, "bookings", "inquiryInbox", "loyalty"];

const MATRIX: Record<Tier, Feature[]> = {
  free: FREE,
  member: MEMBER,
  pro: PRO,
};

export function can(tier: Tier, feature: Feature): boolean {
  return MATRIX[tier].includes(feature);
}

/**
 * Free-tier limits. PLACEHOLDERS — confirm locally (BUILD-BRIEF §14, reference §04).
 * `null` = unlimited.
 */
export const LIMITS: Record<Tier, { bulletinsPerMonth: number | null; photos: number | null }> = {
  free: { bulletinsPerMonth: 3, photos: 5 },
  member: { bulletinsPerMonth: null, photos: null },
  pro: { bulletinsPerMonth: null, photos: null },
};

/** Always-on signals/actions, regardless of tier (resident-side + MVP reputation). */
export const ALWAYS_ON = {
  appearsInSearch: true,
  appearsInCategory: true,
  equalRanking: true, // no paid boosts, ever
  presenceVerifiedBadge: true,
  residentsCanFollow: true,
  residentsCanRecommend: true, // fast-follow feature; positive-only
  privateFeedbackEntry: true, // managed inbox requires Pro (inquiryInbox)
  submitEventsUnlimited: true,
} as const;

/** Bulletin cap check that preserves the "never destroys work" rule.
 *  When over cap, the caller should offer to SCHEDULE for the reset date, not block. */
export function bulletinAllowance(tier: Tier, usedThisMonth: number) {
  const cap = LIMITS[tier].bulletinsPerMonth;
  if (cap === null) return { canPostNow: true, remaining: Infinity, offerScheduleFree: false };
  const remaining = Math.max(0, cap - usedThisMonth);
  return { canPostNow: remaining > 0, remaining, offerScheduleFree: remaining <= 0 };
}
