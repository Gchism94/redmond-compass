# Data source architecture (implemented)

How the app gets its data, and the Supabase serving layer that's now built.
Original guidance: the uploaded `DATASOURCE.md`. This file documents what exists.

## Decision: Path B — read from Supabase

GoHighLevel (GHL) is a CRM (system-of-record for **businesses**), not a public read
backend. So: **GHL → server-side sync → Supabase → the app reads only from Supabase.**
News, Resources, Events, and Bulletins are Supabase-native. GHL sync is **not built
yet** (seam only); it must not block the read path.

```
GoHighLevel ──sync (later)──▶ Supabase (canonical read store, RLS) ──▶ App (PWA, reads only)
                                 ▲ News · Resources · Events · Bulletins authored here
```

The app depends on the `DataSource` interface (`src/data/DataSource.ts`), never on
Supabase directly. Backend swap = one line in `src/data/source.ts` + env:
`VITE_DATA_SOURCE = mock (dev) | supabase | base44`.

## Schema (`supabase/migrations/20260628000000_init.sql`)

Snake_case columns; the DataSource maps them to the camelCase shapes in
`src/lib/types.ts`. Five content types + the recommendations seam:

| Table | Key columns | Notes |
|---|---|---|
| `businesses` | id, name, slug ⊥, category, subcategories[], description, address, lat, lng, phone, website, email, hours(jsonb), photos[], amenity_tags[], claimed, verified, **owner_id**→auth.users, **tier** (free/member/pro), created_at, member_since, **ghl_id** ⊥ nullable, recommend_count, + deferred Member fields (story, owner_spotlight, menu, ctas, gallery, follower_count, post_frequency, response_time) | the spine; GHL-shaped |
| `bulletins` | id, business_id→businesses, body, image, link_cta(jsonb), active_until, scheduled_for, status (draft/scheduled/live/expired), created_at | owner posts |
| `events` | id, business_id→businesses (null = community), title, description, start_at, end_at, venue_name, address, lat, lng, image, category, tags[], link_cta, status | times stored as true instants; read back as Redmond/Pacific wall-clock |
| `news_articles` | id, title, slug ⊥, excerpt, body, image, source, author, published_at | admin-published |
| `resources` | id, name, category (emergency/government/community/utilities), description, phone, url, address | civic |
| `recommendations` | id, business_id→businesses, user_id→auth.users, note, verified_customer, created_at, **unique(business_id,user_id)** | positive-only seam |
| `profiles` | id→auth.users, saved/followed/saved-event/recently-viewed/interests (text[]), notification_prefs(jsonb), location(jsonb), onboarded, owner_business_id→businesses, created_at, updated_at | per-user personalization; auto-created on signup; merges guest local prefs on first sign-in |

**No-stars / equal-ranking guarantee (enforced at the schema):** there is **no
rating/score/value/stars column anywhere**, and **no boost/featured/rank/priority/
sponsored column anywhere**. (Verified by a test that probes for them and by an
`information_schema` scan — both return nothing.)

## RLS + entitlements (`…_20260628000001_rls.sql`, `…_20260628000002_profiles.sql`)

RLS on all seven tables. Policies + triggers mirror `src/lib/entitlements.ts`:

- **Public read** on businesses, events, news_articles, resources, recommendations.
  Bulletins: public reads `live`; the owner also sees own drafts/scheduled.
  → readers always get **complete** free listings (row-level, never column-hidden).
- **Owner writes, gated by ownership + tier:**
  - `businesses`: insert/update/delete only by `owner_id = auth.uid()`; new rows must be `tier='free'`.
  - Trigger `enforce_business_entitlements`: a **free** business may not set the Member
    "enhanced profile" fields (story/menu/gallery/ctas/owner_spotlight), and is capped at **5 photos**.
  - `bulletins`/`events`: writes only by the business owner (`is_business_owner`).
  - Trigger `enforce_bulletin_cap`: free tier ≤ **3 live** bulletins/month — a capped post
    is rejected as `live` (the app offers to **schedule** it free; scheduled bypasses the cap).
- **Recommendations**: **insert-only** by the authed user for themselves
  (`auth.uid() = user_id`); no update/delete policies; `unique(business_id,user_id)` →
  a positive-only count that can't be down-voted or bombed. Trigger `bump_recommend_count`
  increments the cached `businesses.recommend_count` (count can only rise).
- `claim_business(b_id)` — `security definer` RPC to claim an **unclaimed** listing
  (the owner-update policy can't match a null owner), only when truly unowned.
- **`profiles`**: a user may read/write **only their own row** (`auth.uid() = id`); **no
  anon access** (private). Trigger `handle_new_user` auto-creates the row on signup;
  `touch_updated_at` keeps `updated_at` fresh. On first sign-in the app merges the guest's
  localStorage prefs into this row (union of saved/followed/etc.) so nothing is lost.
- Grants: `anon` = select (content tables only); `authenticated` = select + insert/update/delete
  (RLS restricts); `service_role` = all (server-side seed / GHL sync / admin).

## `createSupabaseSource()` (`src/data/supabase/`)

Implements the full `DataSource` contract. `client.ts` makes one Supabase client
(auth + data). `mappers.ts` is the only place column names appear. `SupabaseDataSource.ts`:
category/amenity filters run in Postgres; **open-now / distance / sort run client-side**
— and because no boost column exists, ordering is structurally **relevance (verified,
then nearer) / distance / name / recency only, never a paid boost.** Event `start_at`/
`end_at` round-trip Pacific⇄UTC via `lib/calendar.ts`.

It also implements the **auth + profile** seam: `startEmailAuth`/`verifyEmailOtp`
(passwordless email OTP — `signInWithOtp` → `verifyOtp`, no redirect), `signOut`,
`getAuthUser`, `onAuthChange` (live session), and `getProfile`/`saveProfile` (the
`profiles` row). The single memoized client (`client.ts`, `persistSession`+`pkce`) holds
the JWT, so once the AuthSheet verifies the code **every owner read/write carries it**.

## Auth (wired — BUILD-BRIEF §1, §12 step 6)

Real Supabase Auth, JIT-only. `SessionProvider` delegates to the DataSource: the
`AuthSheet` (the only sign-in surface) does a two-step email → 6-digit-code flow; the
session reflects `onAuthChange` and carries the JWT. Browsing/search are never gated; the
"Keep browsing without an account" escape and the pending-action-completes-after-sign-in
flow are preserved. The owner path (Claim via `claim_business` → Edit → Bulletin → Event)
now persists through the app under RLS + the entitlement triggers. **Mock keeps an instant
sign-in for dev** (`VITE_DATA_SOURCE=mock`). URL config (Site URL + redirects for
`http://localhost:5173` and `https://app.redmondcompass.com`) is in `config.toml`; set the
same in the hosted dashboard. OTP email templates (`supabase/templates/`) surface the code.

**Google OAuth** is offered alongside email OTP ("Continue with Google" in the AuthSheet
+ `/login`). Because OAuth redirects, the gated action is serialized to a **pending intent**
(`rc.pendingIntent`) before the redirect and **replayed** on return (the session picks up
`detectSessionInUrl`+PKCE), so a save/follow still completes — same JIT guarantee as OTP.
The provider is scaffolded in `config.toml` (`[auth.external.google]`, **disabled until a
Google client id/secret is set**); on hosted, enable Google in dashboard → Authentication →
Providers. Mock signs in instantly (no real OAuth) so dev keeps flowing.

## Seeding (`supabase/seed.sql`, generated)

`scripts/gen-supabase-seed.mjs` bundles `src/data/mock/seed.ts` and emits `seed.sql`
(News + Resources authored here; businesses/bulletins/events one-time-imported from the
mock). Re-run to refresh. Applied by `supabase db reset`. **Mock still works for dev**
(`VITE_DATA_SOURCE=mock`) — Supabase and mock share the same seed data.

## GHL seam (not wired)

`businesses.ghl_id` (stable upsert key) + `src/data/ghl/mapping.ts`: a documented
`ghlRecordToBusiness` **stub** (throws). When the sync ships it runs in a Supabase edge
function (webhook + nightly reconcile), `upsert … on conflict (ghl_id)`. The PWA never
calls GHL directly.

## Run it locally

```bash
supabase start                 # Postgres + Auth + PostgREST + Studio (Docker)
supabase status                # local API URL + keys (already in .env / .env.development.local)
supabase db reset              # re-apply migrations + seed.sql
node scripts/gen-supabase-seed.mjs   # regenerate seed.sql from the mock
node scripts/rls-test.mjs      # 18 RLS/schema assertions (guest read / cross-owner write / no-stars…)
node scripts/auth-test.mjs     # 22 auth + owner-path assertions (OTP sign-in → claim/edit/bulletin/event)
npm run dev                    # dev → local Supabase (see env layout below)
```

### Env layout (which Supabase a build talks to)

Vite precedence means the *most specific* file wins. The app is wired so:

| File | Used by | Points at |
|---|---|---|
| `.env` | fallback | local |
| `.env.development.local` | `npm run dev` | **local** (`127.0.0.1:54421`) |
| `.env.production.local` | `npm run build` | **hosted** (`…supabase.co`, publishable key) |

All are gitignored; `.env.example` is the committed template. **Only the anon/publishable
key is ever in the browser — never the service_role/secret key.** (`.env.local`, if present,
sits between `.env` and the mode-specific files; the mode-specific files above take
precedence, so dev stays local and prod stays hosted regardless of what `.env.local` holds.)

### Deploy artifact

The two SQL files in `supabase/migrations/` (+ the new `…_profiles.sql`) **are** the deploy
artifact. The hosted project (`jdrhcmkqtewlzlojixpd`) is `supabase link`-ed; `supabase db
push` applies them (the read-schema set is already up to date — `db push --dry-run` reports
"Remote database is up to date"). `db push` does **not** carry seed; author News/Resources
on hosted or run the seed there explicitly. Mirror Auth URL config + email templates in the
hosted dashboard.
