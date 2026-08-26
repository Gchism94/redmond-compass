# Backlog — deferred cleanups and pending asks

Work that is intentionally not in the current release, recorded so it stays a decision rather
than becoming drift. Product work is separated from code cleanup and owner-operated tasks.

---

## Product features still to develop

The MVP build sequence is complete. These are the remaining user-facing capabilities, not
bugs in the current release.

| Priority | Feature | What exists today | What remains |
|---|---|---|---|
| Fast-follow | **Map search** | A List/Map toggle and placeholder preserve the route and interaction seam. | Choose a map provider; implement pins, viewport-aware results, clustering, and list/map selection sync. |
| Fast-follow | **Yard sales** | Database table and basic RLS exist; there are no live rows. | Resident submission, browse/detail UI, pending-by-default moderation rules, and an identified moderator. |
| Fast-follow | **Verified-customer recommendations** | Positive-only Recommend is live and never changes ranking. | Define qualifying evidence and show the verified-customer distinction without creating a star-rating system. |
| Next | **Classes & workshops management** | Upcoming classes render on business profiles and owner RLS permits writes. | Owner create/edit/cancel UI and validation; keep town-wide promotion out until there is representative inventory. |
| Next | **Membership and business insights** | Tier fields and the Member/Pro entitlement matrix are modeled. | Billing/paywall, member analytics, and demand signals with clear privacy and value propositions. |
| Next | **Live calendar subscriptions** | Per-event and bulk `.ics` export plus Google/Outlook links are live. | A stable `webcal` feed backed by a Supabase function, including update/cancellation behavior. |
| Later | **Pro business tools** | Entitlement seams exist. | Bookings, inquiry inbox, loyalty tools, and follower announcements/perks. |
| Later | **Notifications** | Preference fields and merge behavior remain in the profile model; controls are intentionally hidden. | Delivery infrastructure, permission UX, event/bulletin triggers, unsubscribe controls, and policy copy. |
| Later | **Rewards wallet** | Design/data seams only. | Reward issuance, redemption, history, expiration, fraud controls, and owner administration. |
| Later | **Richer discovery** | Search is conventional text/category filtering. | Storytelling profiles and voice/semantic search, after content quality and accessibility requirements are defined. |

---

## Deferred code cleanups

Each of these is safe to leave indefinitely. None is user-visible.

| # | Item | Why deferred | When to revisit |
|---|---|---|---|
| 1 | **`AuthSheet` copy for `save` / `follow` / `saveEvent`** is unreachable (12 dict keys EN+ES, 3 `COPY` entries, 3 `AuthReason` members) | Save/follow/save-event became guest-local (2026-08-14), so those reasons can no longer be raised. The copy is invisible and promises nothing; removing it is pure housekeeping with zero user impact. Note `"save"` is still the default parameter of `requireAuth`, so removing that member needs a new default. | Next time `session.tsx` or `AuthSheet.tsx` is open for another reason |
| 2 | **`PendingIntent` / `replayIntent` branches for `save` / `follow` / `saveEvent`** | Unreachable from the UI for the same reason. Kept deliberately: a user who was mid-OAuth-redirect when the guest-saves change deployed has one stashed in `localStorage`, and deleting the branch would drop that tap on the floor. | Once any in-flight intents have aged out — safe now, but low value |
| 3 | **`profiles.interests` column** left in the database, inert | The app stopped reading and writing it when interests were removed. Dropping a column is a one-way door and the row count is unknowable from the client (RLS restricts `profiles` to `authenticated`). `rls-test` still uses it as a cross-user write probe. | When someone with service-role access can confirm what is in it |
| 4 | **`rls-test` is not in CI** | Needs a live database. Runs locally against `supabase start`; refuses to run against production by design. Supabase branch databases need a paid plan. | If branching is enabled, or a disposable CI database appears |
| 5 | **`hours.ts` / month-boundary time logic is untested** | Last open item from the 2026-08-14 retrospective. Bit us indirectly: the guest-save test needed a pinned future event because the mock's July-2026 seeds silently emptied Home's events rail in August. | Next time open/closed status or `countBulletinsThisMonth` is touched |
| 6 | **`new Date("YYYY-MM-DD")` parses as UTC — audit the remaining date-only surfaces** | Found once, in the classes section (2026-08-15). A date-only string is specified to parse as **UTC midnight**, so in Redmond (UTC-7/-8) it renders as the **previous day**. `business_classes.date` would have advertised every class one day early. Fixed there by parsing from parts (`formatClassDate` in `lib/format.ts`), with an assertion that catches a regression. **This is the dangerous kind of bug: confidently wrong output, no error, nothing on the page looks broken.** Remaining surfaces — (a) **`yard_sales.start_date` / `end_date`** are `date` columns with no UI yet, so whoever builds that surface hits this first; (b) **`EventQuery.from` / `to`** are documented as "ISO bounds" and fed straight to `new Date()` in both data sources — no caller passes them today, so a date-only value would silently shift the window by a day the moment one does; (c) **structured hours**, once the Sheet populates them — times rather than dates, but the same day-boundary class of error, and `hours.ts` is untested (see #5). Datetime strings without a `Z` (`events.start_at`) parse as LOCAL and are fine — the trap is specific to date-only. | When any of those three surfaces is built or touched |
| 7 | **Three junk space-prefixed Supabase secrets** | Cosmetic; they shadow nothing. | Next dashboard visit |
| 8 | **`smoke` has no `/manage`, owner-surface, or business-profile coverage** | `/account` was added 2026-08-15 after it turned out a 57/57 pass had never visited it — and that immediately exposed three shipping tap-target violations. The owner surfaces have the same blind spot today. | Before the next owner-dashboard change. Known sub-44px controls on the business profile today: address, phone and website links (16px each), Recommend (40px) — found 2026-08-15 while verifying the classes section, which is itself compliant at 44px. |

---

## Pending asks for the directory owner

Content and console work that cannot be done from the repo.

| # | Ask | Detail | Blocking |
|---|---|---|---|
| 1 | **Four Sheet `Category` cells** | Full list, with current and corrected values, in `supabase/functions/sync-sheet/SHEET-CORRECTIONS-2026-08-14.md`. Moves 4 businesses out of "Everything else" and onto real browse tiles. | Nothing — the app handles both states |
| 2 | **Unpin or archive the stale community bulletin** | The only row in `community_bulletins` is *"EXTREME FIRE DANGER in Redmond This Fourth of July"* (2026-07-03) with `pinned = true`, so it sorts **first**. Six weeks stale and reads as current safety guidance. Also its image is on the expiring **base44 CDN** (`check:base44` scans code, not data, so nothing catches this). | **Yes — blocks showing community bulletins in the app.** Deliberately no staleness-threshold logic: one row is not enough to invent a cutoff from, and any cutoff is wrong for the next bulletin (a road closure goes stale in a week, a memorial never does). The source of truth gets corrected, not overridden — same principle as the category cells. |
| 3 | **Release the sync cron hold** | Two steps in the SQL editor: `vault.create_secret` for both names, then the `cron.schedule` block. Sync is manual-only by deliberate choice after the first live run surfaced a real data bug. | Nothing — manual runs work |
| 4 | **Verify `DEPLOY_HOOK_URL`** | Digest never confirmed. | Nothing |
| 5 | **SMTP / DNS / Resend** | Handled separately with the domain owner — **not** to be touched from here. | — |
