# Content sync architecture

This document records what currently owns each content type and how the app should converge
with `redmondcompass.com`. The rule is one-way publication from a named source of truth. A
pair of jobs writing back and forth between Base44 and Supabase would create loops, stale
overwrites, and no reliable answer to “which edit wins?”

## What the live main site does today (verified 2026-09-02)

Read-only network inspection of the public home page shows that the site is still a Base44
application (`6a05e41957c8ee753cb7380c`) and loads three independent public feeds:

- businesses: Base44 function `listBusinessesPublic`; profile data uses Base44 ids and
  `image_url`, often hosted at `media.base44.com`;
- events: Base44 `Event` records filtered to approved rows; the current featured records
  have no `gcal_event_id`, and several generated Google Calendar URLs contain malformed
  time strings (`T600 PM00`, `07NaN00`);
- news: Base44 `NewsPost` records. A service-created “Redmond Compass News Roundup” is
  appearing daily at about 13:01 UTC. The inspected August 30–September 1 roundups have no
  `image_url`, which is why image-independent news cards are required.

The public bundle also exposes owner/admin workflows for pending business and event
approval, business profile editing, newsletter subscribers, business posts, resources,
and a public `getBusinessPublic` function. The schedule, prompt, and credentials for the
daily news automation are not exposed publicly; those must be inventoried inside the
Base44 owner console before it is retired or moved.

## Source-of-truth decision

| Content | Authoritative source | Current delivery to app | Main-site convergence |
|---|---|---|---|
| Businesses | Published main-site `listBusinessesPublic` feed; claimed-owner structured hours win | `business-sync.yml` → Supabase `businesses` every six hours | This is a temporary one-way bridge until both properties read the same Supabase table. The old Google Sheet importer remains an unscheduled recovery tool and must not run concurrently. |
| Business media | Supabase Storage | Sheet stores a bucket filename; app reads `photos[]` | Move surviving Base44/external identity art into Storage. Preserve distinct `logo` and `cover` roles when the schema is expanded. |
| Events | Public Google Calendar for calendar-owned rows; owner submissions for owner-owned rows | six-hour ICS job → Supabase `events`; owner tools write Supabase | Replace the main site's separate Base44 event list with the same published Supabase query. This also removes its broken calendar-link time formatting. |
| News | Base44 daily automation, temporarily | six-hour `news-sync.yml` bridge → Supabase `news_articles` | Short term: Base44 remains the producer. End state: move the automation output to Supabase and have both sites read it. |
| Bulletins/classes | Business owners in this app | Supabase | Main site reads the same public Supabase rows if these surfaces are added there. |
| Resources/notices | Editorial/service-role writes | Supabase after the one-time Base44 import | Move future editorial maintenance to one Supabase-backed admin surface. |

## Bridge safety rules

The business and news bridges are intentionally narrow:

- public main-site functions are read-only; a Supabase service key is used only for the target;
- Base44 ids remain the Supabase row ids, making retries idempotent;
- existing Supabase slugs win, so shared article URLs do not change;
- business rows missing from the public main-site feed are soft-unpublished, never deleted;
- owner-created business rows and the news archive are never auto-unpublished;
- clear business-hours prose is parsed into the canonical seven-day schedule, including
  closed days; ambiguous/appointment/seasonal hours remain faithful prose;
- claimed-owner structured hours are never overwritten by generated schedules;
- an owner-created listing wins over a same-name main-site row with a different id, so a
  source-system id change cannot create a duplicate business in the app;
- duplicate same-name rows inside the main-site feed are collapsed deterministically; the
  more complete, then newer profile wins and every suppressed id is logged;
- the business job rejects fewer than 100 public rows before writing, so an upstream outage
  cannot empty the app directory;
- an unexpected empty upstream response aborts when Supabase already contains news;
- duplicate ids are collapsed and reported before an upsert;
- pure mapping tests and a live dry-run run in each scheduled workflow before production writes.

## Verified cadence and freshness

- Businesses: GitHub Actions at `47 */6 * * *` UTC. The first reconciliation found 147
  approved, profile-enabled main-site listings versus 133 published app rows: 33 source ids
  were new, 114 matched, and 18 stale app rows were soft-unpublished. One new source id was
  the same business as an owner-created Steppe listing and is suppressed in favor of the
  owner record. Of the 147 live source listings,
  114 have authored hours: 66 parse as a weekly schedule, 46 remain prose, and 2 claimed
  owner schedules are preserved. The remaining 33 are blank on the main site itself.
- Events: GitHub Actions at `23 */6 * * *` UTC. Scheduled runs were observed succeeding on
  September 1–2, 2026.
- News: GitHub Actions at `37 */6 * * *` UTC. Scheduled runs were observed succeeding on
  September 1–2, 2026.
- Legacy Sheet: not scheduled. `sync_runs` contains one successful manual run on August 14,
  2026 (132 rows), and no later Sheet run. The database has no `cron` schema, confirming the
  documented pg_cron schedule was never installed. Do not enable it alongside the main-site
  bridge; two writers would make source precedence depend on whichever ran last.

## Remaining owner-console audit

Before moving the main site off Base44, export or record:

1. every scheduled automation name, trigger, enabled state, timezone, and last run;
2. each automation's input sources, transformation prompt/code, and destination entity;
3. the `listBusinessesPublic` and `getBusinessPublic` function contracts;
4. newsletter send/subscriber workflows and unsubscribe handling;
5. pending-business and pending-event approval notifications;
6. the exact GHL/submission automations that publish businesses into Base44;
7. media upload/approval rules for `BusinessPhoto` and profile `image_url`.

That inventory determines which jobs are moved, which are replaced by existing Supabase
flows, and which are obsolete. It should not be inferred from public page output alone.
