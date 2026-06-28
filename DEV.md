# Redmond Compass — App (dev notes)

Mobile-first installable PWA. Hyperlocal directory + community hub for Redmond, OR.
Built per `BUILD-BRIEF.md`; styled from `design-tokens.css`; layouts from the `*-wireframe.html` files.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (try /gallery for the component sheet)
npm run build      # tsc -b && vite build  (+ PWA service worker)
npm run typecheck
```

Primary canvas ~360–390px. Open dev tools device mode (iPhone 12/13 ≈ 390px) for the intended view.

## What's built (BUILD-BRIEF §12, steps 1–7)

- **Scaffold** — Vite + React 18 + TS (strict) + Tailwind 3 + `vite-plugin-pwa`. `design-tokens.css` mirrored into `src/styles/tokens.css` and wired into the Tailwind theme. Playfair Display (headings only) + DM Sans.
- **Design system** — shared components in `src/components` (+ `ui/`), shown at **`/gallery`**.
- **App shell** — bottom-tab nav, routing (§4), 480px content column, a11y baseline (skip link, focus rings, 44px taps), global `prefers-reduced-motion` off-switch.
- **Data layer** — swappable `DataSource` interface (`src/data/DataSource.ts`), `MockDataSource` over fictional seed data, TanStack Query hooks (`src/data/queries.ts`). Pick the backend in **one file** (`src/data/source.ts`) via `VITE_DATA_SOURCE`.
- **Consumer read path** — Home (S2), Search (S3), Results (S4), Business Profile (S5), Events (S6) + detail, Community/News + article, Resources. All on mock data, no auth required.
- **Auth (JIT) + personalization (step 6)** — `SessionProvider` (`src/features/account/session.tsx`): local-first profile (saved/followed/saved-events/recently-viewed/interests/location/notification prefs) persisted to localStorage; mock sign-in. `requireAuth` raises the `AuthSheet` only when a guest taps Save/Follow — never a browse gate. First-launch lite **Onboarding** (location-as-benefit + interest chips, skippable). **Saved** (S7: Businesses · Following · Events) and **Account** (S8) screens. `/login` for deep links. Home personalizes: follow-feed when following, recently-viewed rail for returning users.
- **Calendar integration (step 6b)** — `src/lib/calendar.ts` exports event times as **true UTC** (Redmond/Pacific wall-clock → UTC, DST-aware) so `.ics`/Google/Outlook all land on the right time. `EventCalendar` (month grid, alternate Events view via `SegmentedToggle`), `AddToCalendar` (.ics / Google / Outlook menu) on event detail + cards (Events list, Saved → Events, Results), and a bulk "Add all to calendar (.ics)" in Saved → Events. Live `webcal://` subscription feed is deferred (needs a backend edge function).
- **Owner path (step 7)** — `src/features/owner/*`: Claim/List (B0), light Owner Dashboard (B1), Edit Listing (B4, parity fields + per-day hours editor + amenity chips + completeness), Post Bulletin (B2), Submit Event (B3). Writes go through the `DataSource` (createBusiness/updateBusiness/claimBusiness/createBulletin/createEvent); `MockDataSource` persists them via a localStorage overlay so changes show across the app (and on the public profile). **Free tier only** — Member analytics/demand + Pro tools are entitlement seams (`can(tier, …)`), not rendered (no paywall §3). The free monthly bulletin cap **schedules instead of blocking** (never destroys work). Entry: Account → "Switch to Business" (JIT sign-in).

## Non-negotiables held

- Browse/search free; no auth gate. Save/Follow fire **just-in-time** auth (the AuthSheet), never block browsing.
- **No stars / no rating field.** Reputation at MVP = the automatic **Verified** badge only. Recommend (♥) is a built-but-hidden seam (`ResultCard showRecommend`, `getRecommendations`).
- Equal ranking — no featured/promoted UI anywhere.
- Free listings read **complete** (profile shows nothing "locked"; member/Pro blocks simply don't render).
- Entitlement helper (`src/lib/entitlements.ts`) returns the Free set; deferred fields kept in the model.

## Decisions / flags

- **Map deferred** (§3). Results = list + filters; the List/Map toggle shows a "coming soon" seam.
- **Save = bookmark, Recommend = heart** (wireframes used ♥ for both; split for clarity).
- Community default tab = *All*; Events default view = *list* (both §14 open questions — easy to flip).
- **Backend undecided** (base44 vs Supabase, §2/§14) — non-blocking; implement `DataSource` + set `VITE_DATA_SOURCE`.

## Not built yet (later steps — seams left in place)

- Step 8: Full PWA pass (offline for saved/recent, install prompt, real icons — manifest is scaffolded).
- Deferred features: membership/paywall (B6), Pro tools (B7–B9), Recommendations, Rewards wallet, map search.

> `scripts/shot.mjs` is a dev-only screenshot helper (puppeteer-core → installed Chrome) used to verify screens at 390px.
