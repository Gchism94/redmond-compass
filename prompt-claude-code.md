# Prompt — Claude Code

> Paste this into Claude Code. Attach (or add to the repo): `BUILD-BRIEF.md`, `design-tokens.css`, and all `*-wireframe.html` files.

---

Build **Redmond Compass**, a mobile-first installable **PWA** — a hyperlocal directory and community hub for Redmond, Oregon. It's a separate app from the main redmondcompass.com site, hosted on `app.redmondcompass.com` and installable from there.

**Read first, then build:**
- `BUILD-BRIEF.md` — the master spec. Read it fully before coding. Follow the build sequence (§12), data model (§5), routes (§4), entitlement rules (§6), and PWA requirements (§10).
- `design-tokens.css` — authoritative styling, **translated verbatim from the live redmondcompass.com site** (shadcn/Tailwind HSL convention) for brand parity. Wire into the Tailwind theme (and shadcn if used). Fonts: Playfair Display (headings only) + DM Sans (everything else).
- The `*-wireframe.html` files — visual source of truth for each screen.

**Stack:** React + TypeScript + Vite + Tailwind + `vite-plugin-pwa`. Client-side routing (React Router). TanStack Query for server data. Mobile-first (~360–390px primary canvas).

**Scope: MVP only** (BUILD-BRIEF §3) — the free directory + consumer app + free business listings. Do **not** build deferred features (membership/paywall B6, Pro tools B7–B9, Recommendations, Rewards wallet, map search). But leave seams: build the entitlement helper (§6) returning the Free set, and include the deferred fields in the data model (§5) so features switch on later as config, not migration.

**Non-negotiable principles:**
- Browse & search are free — auth is just-in-time, never a gate.
- Ranking is equal for all — no featured/promoted anywhere.
- No star ratings — no rating field in the schema; reputation is positive-only.
- Free listings are complete, not crippled; a capped action never destroys work; lapse is graceful.

**Start here (BUILD-BRIEF §12, steps 1–5):**
1. Scaffold the project; wire `design-tokens.css` into the Tailwind theme; load the fonts; set up the folder structure (§11).
2. Build the shared design-system components against the tokens (ResultCard, sticky ActionBar, BottomTabNav, chips, toggles, section headers, empty states, badges) — render them in a component-gallery route.
3. App shell: bottom-tab nav + routing + layout; accessibility + reduced-motion baseline.
4. Typed data layer behind a **swappable interface** — mock data first. The backend (base44 API vs a shared Supabase) is undecided (§2); do not hard-code it.
5. Consumer read path on mock data: Home, Search/Results (list + filters; map deferred), Business Profile, Events, Community, Resources.

Before going deep on screens, show me the proposed file/folder structure and the component gallery. Flag any ambiguity rather than guessing — and confirm the data-layer interface so the backend decision stays swappable.
