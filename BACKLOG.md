# Backlog — deferred cleanups and pending asks

Work that is intentionally not in the current release, recorded so it stays a decision rather
than becoming drift. Product work is separated from code cleanup and owner-operated tasks.

---

## Product features still to develop

The MVP build sequence is complete. These are the remaining user-facing capabilities, not
bugs in the current release.

| Priority | Feature | What exists today | What remains |
|---|---|---|---|
| Fast-follow | **Complete owner-system mirror** | The owner's Base44/GHL directory remains authoritative. The app mirrors every public non-ranking Business field plus news every six hours; events sync from Google Calendar. New listings and canonical profile edits route to the main-site workflow, with a copyable app-data handoff for upstream corrections. | Inventory the private Base44/GHL automations and add server-side contracts for anything not exposed publicly, especially approved photo galleries and any owner content the two products should share. |
| Fast-follow | **Map search** | Results ship as a complete list experience; the unfinished toggle has been removed so it cannot masquerade as a live feature. | Choose a map provider; implement pins, viewport-aware results, clustering, and list/map selection sync, then restore the toggle. |
| Fast-follow | **Yard sales** | Database table and basic RLS exist; there are no live rows. | Resident submission, browse/detail UI, pending-by-default moderation rules, and an identified moderator. |
| Fast-follow | **Verified-customer recommendations** | Positive-only Recommend is live and never changes ranking. | Define qualifying evidence and show the verified-customer distinction without creating a star-rating system. |
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
| 6 | **`new Date("YYYY-MM-DD")` parses as UTC — audit the remaining date-only surfaces** | Found once, in the classes section (2026-08-15). A date-only string is specified to parse as **UTC midnight**, so in Redmond (UTC-7/-8) it renders as the **previous day**. `business_classes.date` was fixed with `formatClassDate`; structured-hours special dates now also use the local calendar date and have regression coverage. Remaining surfaces are (a) **`yard_sales.start_date` / `end_date`**, which have no UI yet, and (b) **`EventQuery.from` / `to`**, which no caller currently supplies. | When either remaining surface is built or touched |
| 7 | **Three junk space-prefixed Supabase secrets** | Cosmetic; they shadow nothing. | Next dashboard visit |
| 8 | **Hosted authenticated `/manage` smoke coverage** | A deterministic browser test now signs in, claims a listing, and opens the real dashboard, listing handoff, bulletins, events, and classes with zero page errors. The production-safe smoke still carries no real owner credentials. | Add a dedicated hosted test owner only if the owner approves maintaining that production fixture. |

---

## Pending asks for the directory owner

Content and console work that cannot be done from the repo.

| # | Ask | Detail | Blocking |
|---|---|---|---|
| 1 | **Four Sheet `Category` cells** | Full list, with current and corrected values, in `supabase/functions/sync-sheet/SHEET-CORRECTIONS-2026-08-14.md`. Moves 4 businesses out of "Everything else" and onto real browse tiles. | Nothing — the app handles both states |
| 2 | **Unpin or archive the stale community bulletin** | The row *"EXTREME FIRE DANGER in Redmond This Fourth of July"* (2026-07-03) is still pinned in the source and its image is on the expiring **base44 CDN**. The app now prevents notices older than 30 days from dominating the current board by placing them in a collapsed, dated Past notices archive; an explicit active-until date takes precedence when provided. | No longer blocks the app, but the source row and image should still be corrected. |
| 3 | **Retire or archive the Google Sheet sync path** | Production evidence shows the Sheet importer ran successfully once, manually, on August 14 and its pg_cron schedule was never installed. The main-site business bridge now owns the live six-hour reconciliation; do not activate the Sheet job in parallel. | Nothing — retain it only as a recovery/import tool until the shared Supabase source is complete |
| 4 | **Verify `DEPLOY_HOOK_URL`** | Digest never confirmed. | Nothing |
| 5 | **SMTP / DNS / Resend** | Handled separately with the domain owner — **not** to be touched from here. | — |
| 6 | **Complete and verify directory fields** | Read-only parity audit on 2026-09-03: 147 published source rows represent 146 unique businesses. 114 have main-site hours; 32 have no usable hours in either system. The audit also produces a field-level queue whenever the app has useful information missing upstream. The app labels uncertain schedules as unknown, hides unavailable actions, and never treats fallback coordinates as a real location. | The directory owner must supply or explicitly mark appointment/variable hours for the remaining 32 businesses, then work through any field-level correction queue in the main-site owner workflow. |
| 7 | **Merge the duplicate Rowdy Ranch source profiles** | The main-site public feed publishes two ids for “Rowdy Ranch Boutique and Resale.” The app sync now keeps the more complete/newer record (with phone and hours) and logs/suppresses the older blank record. | Clean up the older Base44/GHL record so the main site itself also shows one profile. |
