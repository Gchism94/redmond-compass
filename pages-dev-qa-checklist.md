# Redmond Compass — First Green Deploy QA (`redmond-compass.pages.dev`)

**When to run:** the moment the Cloudflare Pages build goes green and the `.pages.dev` URL is live. This is staging — no DNS is pointed yet, so it's safe to break things and re-push. Goal: prove the *deployed* build behaves, not just the local one. Several of these can only fail in the real CDN environment, which is the whole point.

**How to read results:** each item has a ✅ pass condition and a ⚠️ if-it-fails handoff for Claude Code. Work top to bottom — earlier failures (routing, env) will mask later ones.

---

## 1. Build & first paint

- [ ] The `.pages.dev` URL loads the home page without error.
- [ ] Desktop (≥1024px) shows **WebShell** (top logo bar, guide links row, navy hero, footer).
- [ ] No console errors on load (DevTools → Console).

✅ Home renders as the site, clean console.
⚠️ White screen or module error → likely a `VITE_` env var missing at build time or a base-path issue; check build log + item 3.

## 2. SPA deep-route refresh (the Pages `_redirects` catch)

The prerendered guide routes are real files, but interactive app routes are client-only and 404 on direct load unless `dist/_redirects` has `/* /index.html 200`.

- [ ] Navigate to `/search` in-app (via nav) — loads ✅ (this always works; it's client routing).
- [ ] Now **hard-refresh** on `/search` (Cmd/Ctrl-Shift-R) — must still load, not 404.
- [ ] Repeat hard-refresh on: `/events`, `/community`, a business profile route, `/account`, `/login`.
- [ ] Direct-paste a deep URL into a fresh tab (e.g. `…pages.dev/search`) — loads.

✅ Every deep route survives a direct hit / refresh.
⚠️ Any 404s on refresh → Claude Code: confirm `dist/_redirects` exists with SPA fallback `/* /index.html 200`, and that prerendered routes are listed BEFORE the catch-all so they aren't shadowed. Rebuild, re-verify.

## 3. Supabase connectivity from the deployed env

Proves the `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set in Cloudflare actually reached the client build (works locally ≠ works deployed).

- [ ] Directory/search route renders **real rows** from Supabase (seed data is fine pre-Sheet-sync — just prove the connection).
- [ ] DevTools → Network: the Supabase request returns 200, not 401/403/CORS error.
- [ ] A save/follow attempt triggers the just-in-time auth prompt (proves the auth client initialized).

✅ Live data loads; Supabase calls succeed from the CDN origin.
⚠️ 401/403 → wrong or missing anon key in Cloudflare env; confirm it's the **anon/publishable** key (never service-role). CORS error → add the `.pages.dev` origin (and later the real domains) to Supabase's allowed origins / auth redirect URLs.

## 4. Prerendered content served from the CDN (SEO proof)

Local prerender was 13/13 — this confirms Cloudflare serves that HTML, not an empty shell.

- [ ] `view-source:` on a guide URL (e.g. `…pages.dev/getting-settled`) shows **real content inside `#root`** (place names, "Dial 211", etc.), not an empty `<div id="root"></div>`.
- [ ] `<title>` and `<meta name="description">` are the guide's own, per-page (not a generic default).
- [ ] Canonical link present; `&` correctly escaped as `&amp;` in source.
- [ ] `/sitemap.xml` loads and lists the guide URLs.
- [ ] Spot-check the Spanish render: the ES version of a guide shows Spanish content and `<html lang="es">`.

✅ Guides are real HTML at the CDN edge with correct meta; sitemap present.
⚠️ Empty `#root` in source → prerender output didn't deploy (check output dir `dist`, and that prerender ran in the Cloudflare build log). Generic meta → injection step didn't run against the deployed shell.

## 5. Old-URL redirects (cutover fidelity)

These matter at DNS cutover but test them now on `.pages.dev`.

- [ ] Mixed-case guide renders: `…/About` loads (not 404).
- [ ] Squashed casing redirects: `…/GettingSettled` → `/getting-settled`.
- [ ] Renamed paths map: `…/directory` → `/search`, `…/News` → `/community`, `…/submit-event` → in-app event form.

✅ Legacy URLs land on correct destinations.
⚠️ Note whether redirects are app-level (JS) or host-level — at cutover, host-level 301s from `pages.tsx`'s redirect map are preferred for SEO. Flag any that 404 for Claude Code.

## 6. Dual-breakpoint smoke on the LIVE url

Point the existing suite at the deployed URL, not localhost.

- [ ] Run `ui-smoke.mjs` (or its logic) against `https://redmond-compass.pages.dev` at **390px** and **1280px**.
- [ ] 390px: AppShell (bottom tabs), 44px taps, no horizontal overflow, EN + ES render, onboarding overlay present on mobile only.
- [ ] 1280px: WebShell (top nav + footer), 3–4 col directory grid, guides at readable width, **no "Featured" text anywhere** (non-negotiable guard), no overflow.
- [ ] Zero console errors at both widths.

✅ 30/30-equivalent green against the live origin.
⚠️ Any assertion that passes locally but fails live → environment/asset-path difference; capture the failing assertion for Claude Code.

## 7. PWA install & assets

- [ ] Mobile viewport: "Sign in / Get the app" present; install prompt fires on Chromium/Android, iOS shows Share → Add to Home Screen instructions.
- [ ] Manifest loads (DevTools → Application → Manifest: name, icons, theme color correct).
- [ ] Service worker registers without error; a second load works offline (airplane mode → cached pages render).
- [ ] **base44 gate in the wild:** DevTools → Network, reload, filter for `base44` → zero requests. Confirms no image/asset still points at the dying CDN.

✅ Installable, offline-capable, zero base44 requests.
⚠️ base44 requests appearing → an asset URL survived the sweep; hand the specific URL(s) to Claude Code to rehost to Supabase Storage.

## 8. Analytics (only after the beacon is wired)

If Cloudflare Web Analytics is already added:
- [ ] Beacon loads (Network shows the CF analytics request), and the Web Analytics dashboard registers the visit.
- [ ] No analytics **cookie** is set (it's cookieless — Application → Cookies should show none from analytics).

If not yet wired, skip — it's a fast follow, not a cutover blocker.

---

## Result triage

- **All ✅** → staging is trustworthy. Remaining before cutover is non-code: Sheet + service account setup, function deploy + cron, attorney pass on the privacy policy, Spanish of final policy text, then DNS.
- **Failures in 2 or 3** (routing/env) → fix first; they mask everything downstream.
- **Failures only in 4** (prerender-at-CDN) → SEO risk, fix before cutover but doesn't block continued QA.
- Log each failure with the exact URL + the DevTools evidence so Claude Code reproduces against the same deployed build, not local.
