# Stage 1 — Base44 import report (dispositions executed)

**Date:** 2026-07-10 · **Sign-off:** Greg ("add to Supabase; add the businesses; absorb the
schema deltas; pause only where GHL-first is better — consolidate later")

## Schema deltas absorbed — `supabase/migrations/20260710000000_base44_parity.sql`
- **businesses** + `long_description, message_link, socials(jsonb), license_number,
  specials(+image), additional_locations(jsonb), extra_categories[], hours_text`.
  **No featured/boost column** — the 5 Base44 `featured` flags were dropped on import.
- **events** + `approval_status(pending|approved), submitter_name, submitter_email,
  gcal_event_id(unique)`; public read policy narrowed to **approved** rows (owners still
  see their own pending).
- **news_articles** + `category, pinned(editorial), source_url`.
- **resources**: category CHECK widened 4 → 10; + `subcategory, image_url, email,
  additional_phones(jsonb), service_times, facebook, instagram`.
- **New tables (RLS'd):** `community_bulletins` (public read), `community_videos`
  (public read; `is_default` = editorial default video, not paid placement),
  `business_classes` (public read; owner writes via `is_business_owner`),
  `yard_sales` (public reads **approved** only; writes service-role until the Phase 2
  submit flow; `contact_email` must never render publicly).
- App absorption: types/mappers extended; taxonomy roll-ups cover the Base44 display
  categories; ResourcesScreen renders all 10 groups; profile shows `hours_text` when
  structured hours are absent.

## What was imported (idempotent — upsert on the Base44 id; re-run safe)
| Table | Rows | Source & notes |
|---|---|---|
| businesses | **132** | 130 Base44 + **2 sheet-only** (Alpenglow Films, Beland Tax & Notary; ids `b44s_…`). Approved BusinessPhotos merged into `photos[]` (cap 5). `verified=false` (earned in-app). `lat/lng` NULL → app falls back to Redmond center; **geocoding is a follow-up**. |
| events | 111 | 107 upcoming/4 past; 2 imported as `pending` (hidden from public by RLS). Times parsed from free text; **33 had no parseable time → 12:00 PT** (flag for editorial fix). `submitter_email` NOT imported (privacy — archived in snapshot). 8 carry `gcal_event_id` for the future ICS sync. |
| news_articles | 11 | with category/pinned/source_url |
| resources | 57 | all 8 live categories now render |
| business_classes | 10 | FK to real businesses |
| community_bulletins | 1 | the July 4 fire-danger announcement |
| community_videos | 2 | `featured` → `is_default` |
| auth users | 10 | 8 Base44 accounts + **2 owner-email grants without accounts** (Alexandra/Preferred Mortgage, Dylan/Wilson's of Redmond) — created confirmed, no email sent; first OTP/Google sign-in lands them **owning their business** (owner_id + claimed set, profile linked). |

**Skipped by disposition:** BusinessAnalytics (169 — archive-only in the snapshot),
BusinessReview (empty), YardSale (0 records; table ready). Fictional dev-seed rows were
purged by exact id (app-created rows can never match).

## GHL consolidation seam (per "sync + consolidate later")
Imported businesses keep the Base44 id as row id with `ghl_id = NULL`. When the GHL sync
lands (blocked on the structure decision), reconcile by name+address match → set `ghl_id`
on the existing row (upsert key) instead of inserting a duplicate.

## Verification
Local: migration applies on reset; import + re-run idempotent (132/132, no dupes);
rls-test 18/18; auth-test 22/22; typecheck + build green; six screens at 390px render the
real data (real names/photos, category roll-ups, resources in all populated groups),
zero console errors.

Hosted: **DONE (2026-07-10, Greg-approved).** The project had auto-paused (free tier,
~12 days idle) and was restored first. Migration pushed; import ran identically
(132/111/11/57/10/1/2 + 10 users, 2 owner links); fictional demo rows replaced by real
content. Verified against hosted: rls-test **18/18**, pending events hidden from anon
(109/111 visible), owner links live, parity fields publicly readable, and the production
build renders all six screens with real data at 390px — zero console errors.

⚠️ **Free-tier auto-pause**: the hosted project pauses after ~7 idle days, taking the
live data down. Move to Pro (or add a keep-alive) **before the Phase 3 DNS cutover**.

## Follow-ups (not blocking)
1. ~~Geocode~~ DONE 2026-07-10: 102/132 geocoded (Nominatim, 50-mi sanity radius, cache in migration/geocode-cache.json). Remaining 30: 17 no address, 13 junk/unmappable addresses — editorial fix list.
2. Editorial pass on the 33 noon-defaulted event times.
3. Structured-hours parsing (or owner edit) to replace `hours_text` over time.
4. Phase 2 UI for community bulletins / videos / classes / yard-sale submit flow.
