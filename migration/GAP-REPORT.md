# Stage 1 · Phase 0 — Snapshot & Gap Report

**Date:** 2026-07-10 · **For review by:** Greg (Phase 1 does not proceed until this is reviewed)

## 1. What was captured (insurance snapshot)

`migration/base44-snapshot-2026-07-10/` — full raw export of every Base44 entity via the
data-ports API, plus every referenced media file (Base44-hosted URLs die when Base44 is
canceled). Integrity hashes in `manifest.json`. Re-download: `BASE44_API_KEY=<key>
node migration/scripts/base44-snapshot.mjs` (key lives in env only — never committed).

| Entity | Records | Notes |
|---|---|---|
| Business | 130 | 5 `featured` · 116 `profile_enabled` · **2 with `owner_email`** · 10 multi-category |
| Event | 111 | 107 future / 4 past · **only 8 linked to Google Calendar** (`gcal_event_id`) · 2 pending approval |
| Resource | 57 | uses **8 categories** (community 25, education 20, health 4, mental_health 3, utilities 2, transportation 1, emergency 1, government 1) |
| NewsPost | 11 | 4 pinned |
| BusinessClass | 10 | class/workshop listings tied to businesses (Jun–Sep 2026 dates) |
| User | 8 | roles admin + user; passwords **cannot** be exported (re-auth plan required) |
| BusinessPhoto | 4 | all `approved` (approval workflow exists in Base44) |
| BusinessPost | 2 | owner posts (≈ our bulletins) |
| CommunityVideo | 2 | YouTube embeds |
| Bulletin | 1 | community bulletin board ("EXTREME FIRE DANGER…", pinned announcement) |
| BusinessReview | 0 | **empty** — the star-ratings entity has no data ✔ (no-stars policy conflict is moot) |
| YardSale | 0 | live page exists (`/yard-sales`); no records yet |
| BusinessAnalytics | 169 | profile_view / website_click events |

**Media:** 151 referenced files → **150 downloaded** to `media/`. 1 failure: an expired
Facebook-CDN signed URL (HTTP 403; external, not Base44-hosted — recoverable manually from
the business's Facebook page if wanted).

**Reference sources also snapshotted** (`google-refs/`):
- **Google Sheet** (CSV + XLSX): 132 business rows. Header matches the Base44 Business schema
  exactly → this sheet is the output of Base44's `exportBusinessesToSheet` function — an
  **export artifact, not an independent source**.
- **Google Calendar** (public ICS, no Google Cloud project needed): 34 events,
  `X-WR-TIMEZONE: America/Los_Angeles` (the embed link's `ctz=America/Phoenix` is display-only).

## 2. Content-page inventory

`migration/content/` — **26 routes** captured from the live SPA as markdown + downloaded
image assets + full-page screenshots (`inventory.json` has the list). All 12 pages named in
the brief were found, two of them unlinked from the homepage:
- **New to the Area** lives at `/new-to-the-area`; **Ember Memorial** lives at **`/ember`**.
- `/pets` and `/yard-sales` are live routes (answers the open question — see §5).
- `/resources` renders its list only after a category tap; page copy captured, the 57
  records are fully in the JSON snapshot.

**Live-site quirks found:**
- URL casing is **mixed**: `/About` and `/News` render, but `/GettingSettled` 404s (canonical
  routes are kebab-case). → The Phase 2 redirect map needs **explicit per-route entries**.
- The homepage's featured-business links (`/business/<id>`) render "This business profile is
  not available" on the live site today.

## 3. Gaps requiring your decision

### 3a. Data that exists ONLY in Base44 (candidates the GHL sync will never carry)
| What | Count | Proposed disposition |
|---|---|---|
| Users (auth accounts) | 8 | Import emails/profiles to Supabase Auth; re-auth via OTP/Google at first sign-in (Phase 1.4) |
| Events without `gcal_event_id` | 103 | One-time import to Supabase `events` (calendar sync covers only 8 today) |
| NewsPost | 11 | One-time import to `news_articles` (needs `category`/`pinned`/`source_url` columns) |
| Resource | 57 | One-time import to `resources` (**needs category constraint widened** — see 3c) |
| BusinessClass | 10 | No equivalent table — import as events? or new table? **decide** |
| Bulletin (community board) | 1 | No equivalent — the PWA's bulletins are business posts. New `community_bulletins` seam or drop? **decide** |
| CommunityVideo | 2 | No equivalent — content page embed or table? **decide** |
| BusinessPhoto approval workflow | 4 rows | Photos can merge into `businesses.photos[]`; the pending-approval workflow has no Supabase equivalent yet |
| BusinessAnalytics | 169 | Analytics is a deferred Member feature in the PWA. Archive-only (snapshot keeps it)? **recommend: don't migrate** |
| BusinessReview | 0 | Empty; policy says no stars regardless. **Nothing to do** ✔ |

### 3b. Cross-source conflicts
- **Sheet-only businesses (2):** "Alpenglow Films", "Beland Tax & Notary Services" — in the
  Google Sheet but **not** in Base44. Decide: add to GHL (canonical) or drop.
- **Calendar-only events (26):** in Google Calendar but never imported to Base44. The Phase 1
  inbound sync will pick these up automatically — no action, just aware.
- **GHL diff: BLOCKED.** No GHL API key/location ID yet, and the Business structure decision
  (custom object vs company/contact) is unresolved. Everything above is provisional until we
  can diff against GHL. **This is the #1 blocker for Phase 1.**

### 3c. Schema deltas (Base44 → our Supabase) to absorb in Phase 1
- `resources.category` CHECK allows 4 values; Base44 uses 8 (+2 unused). **Widen constraint**;
  also missing: `subcategory`, `image_url`, `additional_phones[]`, `email`, `service_times`, socials.
- `businesses`: Base44 has `message_link`, `long_description`, socials (7 networks),
  `additional_locations[]` (up to 5), `license_number`, `specials(+image)`, multi-`categories[]`,
  `hours` as free text (ours is structured jsonb — needs parsing or a fallback text field).
  **`featured` will NOT be migrated** (5 businesses currently flagged) — equal ranking is
  non-negotiable; there is deliberately no column for it.
- `events`: Base44 has approval `status` (pending/approved), `submitter_name/email`,
  `gcal_event_id`. Ours has none of these — needed for the calendar sync + submit flow.
- `news_articles`: Base44 has `category`, `pinned`, `source_url`; ours doesn't.
- Base44 business categories (16, kebab-case) ≠ our taxonomy labels — mapping table needed.

## 4. Recommendations (non-blocking, flagging before Phase 1)
1. **Calendar sync via public ICS polling** — the calendar is public; inbound sync needs **no
   Google Cloud project** (dedupe on `UID` ≙ `gcal_event_id`, TZ America/Los_Angeles,
   consistent with the existing DST-aware utilities). OAuth/API can come later if we need
   private calendars or webhooks.
2. **Treat the Google Sheet as verification only** (it's a Base44 export), except the 2
   sheet-only businesses in 3b.
3. The 5 "not available" business-profile links on the live homepage suggest checking
   `profile_enabled` data before cutover parity QA.

## 5. Open questions from the brief — now answerable
- **Yard sales / pets:** `/yard-sales` is a dynamic submit-and-browse feature (entity exists,
  0 records); `/pets` is a curated content page (captured to markdown). News is dynamic
  (11 records). Route accordingly in Phase 2.
- **Submissions write-back to GHL?** Default stands (Supabase-only, one-way sync) — nothing
  found in Phase 0 that argues otherwise.

## 6. Still needed to start Phase 1 (blocking)
1. **GHL API key / location ID + the Business structure decision** ← biggest blocker
2. Sign-off on the dispositions in §3a/3b above
3. Hosting choice + DNS registrar access (Phase 3)
4. Sign-off on the user re-auth approach + notice copy (draft in Phase 1)
