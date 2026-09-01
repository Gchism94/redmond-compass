# Content sync architecture

This document records what currently owns each content type and how the app should converge
with `redmondcompass.com`. The rule is one-way publication from a named source of truth. A
pair of jobs writing back and forth between Base44 and Supabase would create loops, stale
overwrites, and no reliable answer to “which edit wins?”

## What the live main site does today (2026-09-01)

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
| Businesses | Google Sheet for editorial fields; claimed-owner structured hours win | `sync-sheet` → Supabase `businesses` | Main site should read published Supabase rows, or temporarily pull/upsert them by stable business id. Do not push Base44 edits back into the Sheet. |
| Business media | Supabase Storage | Sheet stores a bucket filename; app reads `photos[]` | Move surviving Base44/external identity art into Storage. Preserve distinct `logo` and `cover` roles when the schema is expanded. |
| Events | Public Google Calendar for calendar-owned rows; owner submissions for owner-owned rows | six-hour ICS job → Supabase `events`; owner tools write Supabase | Replace the main site's separate Base44 event list with the same published Supabase query. This also removes its broken calendar-link time formatting. |
| News | Base44 daily automation, temporarily | six-hour `news-sync.yml` bridge → Supabase `news_articles` | Short term: Base44 remains the producer. End state: move the automation output to Supabase and have both sites read it. |
| Bulletins/classes | Business owners in this app | Supabase | Main site reads the same public Supabase rows if these surfaces are added there. |
| Resources/notices | Editorial/service-role writes | Supabase after the one-time Base44 import | Move future editorial maintenance to one Supabase-backed admin surface. |

## Bridge safety rules

The news bridge is intentionally narrow:

- public Base44 `NewsPost` is read-only; a Supabase service key is used only for the target;
- Base44 ids remain `news_articles.id`, making retries idempotent;
- existing Supabase slugs win, so shared article URLs do not change;
- missing upstream rows are never deleted or unpublished; the archive is preserved;
- an unexpected empty upstream response aborts when Supabase already contains news;
- duplicate ids are collapsed and reported before an upsert;
- the pure mapping test runs in the scheduled workflow before production writes.

## Remaining owner-console audit

Before moving the main site off Base44, export or record:

1. every scheduled automation name, trigger, enabled state, timezone, and last run;
2. each automation's input sources, transformation prompt/code, and destination entity;
3. the `listBusinessesPublic` and `getBusinessPublic` function contracts;
4. newsletter send/subscriber workflows and unsubscribe handling;
5. pending-business and pending-event approval notifications;
6. any workflow that exports businesses to the Google Sheet;
7. media upload/approval rules for `BusinessPhoto` and profile `image_url`.

That inventory determines which jobs are moved, which are replaced by existing Supabase
flows, and which are obsolete. It should not be inferred from public page output alone.
