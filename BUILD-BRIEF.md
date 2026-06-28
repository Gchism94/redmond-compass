# Redmond Compass — App Build Brief (v1 / MVP)

> The single document to read first. It states what to build, in what order, and the rules that the wireframes assume. Pair it with `design-tokens.css` (styling) and the eight wireframe HTML files (visual source of truth). For the full model, guardrails, entitlement matrix, and phasing, open `redmond-compass-build-reference.html`.

---

## 1. What this is

A mobile-first **Progressive Web App (PWA)** version of Redmond Compass — a hyperlocal directory + community hub for Redmond, OR. It is a **separate app from the main redmondcompass.com site**, hosted on its own subdomain (suggested: `app.redmondcompass.com`) and **installable as a PWA**, with a "Get the app" entry point on the main site.

**Core job:** help residents find the right local business fast, and keep them coming back with events, news, and bulletins. The directory is the spine; everything else is engagement.

**Two principles that govern every screen** (see the reference for the full set):
- **Browse & search are free** — no login required to explore. Login only gates save / follow / post.
- **Ranking is equal for everyone; reputation is positive-only.** No paid placement, no promoted posts, **no star ratings**. (See §8.)

---

## 2. Tech direction

- **App type:** installable PWA, mobile-first, responsive. Primary canvas ~360–390px.
- **Recommended stack:** **React + TypeScript + Vite**, styling via **Tailwind** (map `design-tokens.css` into the theme) or plain CSS variables. PWA via **`vite-plugin-pwa`** (manifest + service worker).
  - *Alternative:* **Next.js (App Router)** if you want server-rendered, SEO-indexable public pages (directory, business profiles) inside the app itself. If the main site already owns directory SEO, the simpler Vite SPA is fine.
- **Routing:** client-side (React Router) for the SPA path.
- **State:** lightweight (React Query / TanStack Query for server data + a small store for UI/session). Avoid heavy global state.
- **Hosting:** static host/CDN (Vercel, Netlify, Cloudflare Pages) on `app.redmondcompass.com`.

### Data source — DECIDED: Supabase
**Backend + auth = Supabase** (Postgres + Auth + Storage + row-level security, which maps cleanly onto the entitlement rules). The app reads the same five data types the main site manages (businesses, bulletins, events, news, resources).

- **base44** (the current site) data gets **ported in**; a **GoHighLevel connector** is a separate integration (CRM/marketing).
- Everything stays behind the typed data-access layer (`src/data/source.ts`) so the base44 port and the GHL connector are isolated and don't touch app code.
- Auth is just-in-time (Supabase Auth), only at save/follow/post — never a gate.

---

## 3. MVP scope

**Ship in v1 (the free directory + consumer app):**
- **Consumer:** Onboarding (S1), Home (S2), Search (S3), Results (S4), Business Profile (S5, basic), Events (S6), Saved (S7, no Rewards tab), Account (S8), Community/News, Resources.
- **Business (free):** Claim/List (B0), light Owner Dashboard (B1 = "manage my listing"), Edit Listing (B4, current-site parity), Post Bulletin (B2), Submit Event (B3).
- **Reputation at MVP:** automatic **"claimed & verified"** badge only. No Recommend button yet.
- **No tiers, no paywall, no modules.**

**Deferred — design-ahead, switch on later (do NOT build for v1, but model the data so they slot in):**
- *Fast-follow:* map search, Recommendations + verified-customer, then the **Member** tier + paywall (B6), full analytics + demand signals (B5).
- *Later (v2):* Pro tools — Bookings (B7), Inquiry Inbox (B8), Loyalty (B9) + Rewards wallet; storytelling profiles; follower announcements/perks; voice/semantic search.

> The free listing at MVP is **current-site parity**: name, category, description, address, hours, contact, a photo. Nothing heavier.

---

## 4. Routes (suggested)

| Route | Screen | Notes |
|---|---|---|
| `/` | Home (S2) | personalized feed; cold-start fallback |
| `/search` | Search/Explore (S3) | idle browse + autocomplete |
| `/search/results` | Results (S4) | list ⇄ map (map = fast-follow), filters |
| `/b/:slug` | Business Profile (S5) | the destination |
| `/events` · `/events/:id` | Events (S6) | time-grouped |
| `/community` · `/news/:slug` | Community/News | feed of news + bulletins |
| `/resources` | Resources | categorized civic list |
| `/saved` | Saved (S7) | tabs: businesses · following · events (· rewards later) |
| `/account` | Account (S8) | prefs, notifications, mode switch |
| `/login` `/register` `/forgot` `/reset` | Auth | **just-in-time only**, never a gate |
| `/claim` | Claim/List (B0) | free |
| `/manage` | Owner Dashboard (B1) | light at MVP |
| `/manage/edit` | Edit Listing (B4) | current-site parity |
| `/manage/bulletin/new` | Post Bulletin (B2) | |
| `/manage/event/new` | Submit Event (B3) | |
| *(later)* `/manage/membership` | B6 | tiers + plan |
| *(later)* `/manage/tools/*` | B7–B9 | Pro tools |

---

## 5. Data model

Code against these entities. Fields marked *(later)* are for deferred features — include in the schema so turning features on is a config change, not a migration scramble.

**Business** — the spine
`id · name · slug · category · subcategories[] · description · address · lat · lng · phone · website · email · hours{ perDay: {open,close,closed}, special[] } · photos[] (MVP cap 5) · amenityTags[] · claimed:bool · verified:bool · ownerId · tier:'free'|'member'|'pro' (MVP always 'free') · createdAt · memberSince`
*(later)* `story · ownerSpotlight · menu[] · ctas[] · gallery[] · derived: followerCount, postFrequency, responseTime`

**Bulletin** (business post)
`id · businessId · body (char-limited) · image? · linkCta? · activeUntil? · scheduledFor? · status:'draft'|'scheduled'|'live'|'expired' · createdAt`

**Event**
`id · businessId? (null = community) · title · description · startAt · endAt · venueName · address · lat · lng · image? · category? · tags[] · linkCta? · status`

**NewsArticle** (admin-published)
`id · title · slug · excerpt · body · image? · source · author? · publishedAt`

**Resource**
`id · name · category:'emergency'|'government'|'community'|'utilities' · description · phone? · url? · address?`

**User** (resident)
`id · email · name · role:'resident'|'owner'|'admin' · interests[] · location? · savedBusinessIds[] · followedBusinessIds[] · savedEventIds[] · recentlyViewedIds[] · notificationPrefs{ followedBulletins, savedEvents, localNews }`

*(later)* **Recommendation** `id · businessId · userId · note? · verifiedCustomer:bool · createdAt` — **positive-only; there is no rating value field, by design.**
*(later)* **LoyaltyProgram / Membership(card) · Booking · Inquiry** — model when those features ship.

> The 5 content data types are **Business · Bulletin · Event · NewsArticle · Resource**. **Recommendation** is a lightweight 6th, added fast-follow.

---

## 6. Entitlements & feature gating

Build a **single entitlement helper** keyed on `business.tier`, read everywhere a feature is gated. At MVP it always returns the Free set, but the abstraction must exist now.

- `can(business, 'unlimitedBulletins')`, `can(business, 'enhancedProfile')`, `can(business, 'fullAnalytics')`, `can(business, 'bookings')`, etc.
- The **entitlement matrix in `redmond-compass-build-reference.html` (§02) is the source of truth** for what each tier unlocks. The MVP ships only the **Free** column.
- Rules that never change: **free listings are complete, not crippled**; **a limit never destroys work** (a capped bulletin can be scheduled free for the reset date); **lapse is graceful** (revert to free, data intact).

---

## 7. (No section — see §8)

---

## 8. Reputation model — no stars, by design

This is a deliberate anti-Yelp stance. Implement exactly:
- **No 1–5 rating anywhere.** There is no rating value in the schema.
- **Presence/activity signals** (automatic, all tiers): claimed & verified, posts-weekly, follower count, "usually replies in a day," member-since. Factual, derived — MVP ships at least "claimed & verified."
- **Recommendations** *(fast-follow)*: a **positive-only count** that can't be down-voted or bombed. Login required. People who transacted (booking/loyalty) get a "verified customer" badge for weight. A new/quiet business reads **"New to Compass"** — neutral, never a damning low score.
- **Private feedback** *(with Inquiry Inbox, Pro)*: an unhappy customer is routed to "share feedback privately with the owner," never a public post. Service recovery, not punishment.

See the `redmond-compass-consumer-surfaces-wireframe.html` for the exact UI.

---

## 9. Design system

- **Tokens:** `design-tokens.css` is authoritative — it's **translated verbatim from the live redmondcompass.com site** (shadcn/Tailwind HSL convention) so the app keeps brand parity. Map into Tailwind `theme.extend` / shadcn.
- **Type:** **Playfair Display** (headings/display ONLY — screen titles, section heads, hero) + **DM Sans** (everything functional: body, UI, buttons, labels, metadata). Load via Google Fonts. No mono.
- **Color meaning (brand parity):** amber `#C86604` = primary CTAs; terracotta `#D76942` = accent/highlights; pine green `#2E6049` = positive / "open now" / links / focus; deep navy `#082954` = primary text; warm cream `#FAF8F5` = background; white = cards.
- **Note:** the wireframes used placeholder styling (Space Grotesk / teal / brass); `design-tokens.css` supersedes that. Use the tokens, not the wireframe colors/fonts. The `--wire-*` grays are wireframe scaffolding — **do not ship**.
- **Key shared components** (build once, reuse everywhere):
  - **ResultCard** — thumbnail, name, category, open-status + closing time, distance, recommend count (♥, *not* stars), inline **Call · Directions · Save** actions. Used in Search results, Saved, Home rails.
  - **ActionBar** — sticky Call · Directions · Save · Follow on the profile (same verbs as ResultCard).
  - **BottomTabNav** — Home · Search · Events · Saved · Account.
  - **SectionHeader** with "See all", **Chip/Pill**, **Toggle**, **StickySaveBar**, **StatusBadge**, **CompletenessMeter**, **EmptyState** (always routes forward — dead ends are not allowed).
- **No featured/promoted UI** anywhere — the feed and results are organic.
- Respect `prefers-reduced-motion`; meet tap-target (44px) and contrast minimums.

---

## 10. PWA requirements

- **Installable** from `app.redmondcompass.com`, with a "Get the app / Add to Home Screen" prompt; surface a "Get the app" link on the main redmondcompass.com site that points here.
- **`manifest.webmanifest`** — example:
  ```json
  {
    "name": "Redmond Compass",
    "short_name": "Compass",
    "start_url": "/",
    "display": "standalone",
    "theme_color": "#082954",
    "background_color": "#FAF8F5",
    "icons": [
      { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
      { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
    ]
  }
  ```
- **Service worker** (via `vite-plugin-pwa`): cache the app shell; cache-first for static assets, network-first with fallback for data. **Offline behavior** matters — several screens specify cached states (last feed, saved items, last-viewed profile's hours/phone). Saved + recently-viewed should be available offline.
- **Install/onboarding:** first launch = lite onboarding (location permission framed as benefit + interest chips), all skippable. Store prefs locally until/unless the user creates an account.
- Standard PWA hygiene: apple-touch-icon, theme-color meta, viewport-fit, splash, 192/512 + maskable icons.

---

## 11. Suggested project structure

```
src/
  app/            # routes / pages
  components/     # shared UI (ResultCard, ActionBar, BottomTabNav, ...)
  features/
    directory/    # search, results, profile
    events/
    community/
    resources/
    saved/
    account/
    owner/        # claim, dashboard, edit, bulletin, event  (+ later: membership, tools)
  data/           # typed data-access layer (swappable: base44 | supabase)
  lib/            # entitlements.ts, geo, hours, formatting
  styles/         # tokens.css (from design-tokens.css), tailwind config
  pwa/            # manifest, sw registration, icons
```

---

## 12. Build sequence (for Claude Code)

1. **Scaffold** — Vite + React + TS + Tailwind + vite-plugin-pwa; wire `design-tokens.css` into the theme; load fonts.
2. **Design system** — build the shared components (§9) against the tokens; render them in a quick component gallery.
3. **App shell** — BottomTabNav + routing + layout; mobile frame; reduced-motion + a11y baseline.
4. **Data layer** — typed models (§5) behind a swappable data-access interface (mock data first).
5. **Consumer read path** — Home, Search/Results (list + filters; map deferred), Business Profile, Events, Community, Resources. This is most of the value and needs no auth.
6. **Auth (JIT) + personalization** — login only at save/follow (Supabase Auth); Saved, Account, interests, notifications prefs.
6b. **Calendar** — `EventCalendar` list⇄calendar toggle on Events (S6); `AddToCalendar` (export) on event detail + event cards; "Add all to calendar" on Saved → Events. Client-only (`src/lib/calendar.ts`), no backend. Times convert to UTC for correct export across calendar apps.
7. **Owner path** — Claim/List, light Dashboard, Edit Listing (parity fields), Post Bulletin, Submit Event. Stub the entitlement helper (Free only).
8. **PWA** — manifest, service worker, offline for saved/recent, install prompt + main-site entry point.
9. **Polish** — empty/loading/offline states, copy, performance, Lighthouse PWA pass.

> Deferred (B5, B6, B7–B9, Recommendations, Rewards wallet, map, **live calendar subscription / webcal feed** = a Supabase edge function): leave seams in the entitlement helper and data model; do not build for v1.

---

## 13. Handoff notes

- **Claude Design:** start from `design-tokens.css` + the wireframe HTMLs. Produce hi-fi screens per the wireframes, using the tokens as the system. Keep the no-stars / no-featured / honest principles; don't invent rating UI.
- **Claude Code:** start from this brief + tokens + wireframes. Follow §12. Code against the swappable data layer so the base44-vs-Supabase decision doesn't block frontend progress.

---

## 14. Open decisions
- ~~Data source: base44 API vs shared backend~~ → **DECIDED: Supabase** (§2). base44 data ported in; GoHighLevel connector is a separate integration behind `src/data/source.ts`.
- Subdomain + main-site "Get the app" placement.
- MVP required vs optional listing fields; hours editor (day-by-day vs presets); photo cap (5 placeholder).
- Community default tab (All vs News); Events default view (list vs calendar); Resources data sourcing/maintenance.
- Confirm placeholder prices/tiers before the fast-follow monetization work (not needed for MVP).

## 15. Source caveat
This package was designed from the current site's information architecture; the live site is client-rendered, so listings weren't directly inspectable. The free-listing field set is modeled on a standard directory at current-site parity — confirm against the real base44 schema when wiring data.
