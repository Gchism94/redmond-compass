# Redmond Compass — App Starter Package

Everything needed to design and build the Redmond Compass PWA (v1 / MVP). Start here.

## What's in this package

**Read first**
- **`BUILD-BRIEF.md`** — the master spec: tech direction (PWA), MVP scope, routes, data model, entitlements, the no-stars reputation rules, design system, PWA requirements, and a phased build sequence.
- **`design-tokens.css`** — the shared styling foundation (colors, type, spacing, radii, shadows), **translated verbatim from the live redmondcompass.com site** (shadcn/Tailwind HSL convention) so the app keeps brand parity: Playfair Display + DM Sans, warm cream + deep navy, amber primary, terracotta accent, pine-green positive. Authoritative for both design and code; supersedes the wireframes' placeholder styling.

**Source of truth — reference**
- **`redmond-compass-build-reference.html`** — the full model in one chart: guardrails, flow map (every screen + status), the entitlement matrix (Free / Member / Pro), the no-stars trust system, and the MVP-first build phasing. Open in a browser.

**Wireframes** (interactive — open in a browser; most have state toggles)
- `redmond-compass-s5-wireframe.html` — Business Profile (Free ⇄ Member toggle)
- `redmond-compass-s3-s4-search-wireframe.html` — Search + Results (idle/typing; list/map/no-results)
- `redmond-compass-s2-b4-wireframe.html` — Home + Edit Listing (personalized/cold-start; MVP/post-MVP fields)
- `redmond-compass-consumer-surfaces-wireframe.html` — Reputation block + Rewards wallet
- `redmond-compass-b1-dashboard-wireframe.html` — Owner Dashboard (Free/Member/Pro)
- `redmond-compass-module-setup-wireframe.html` — Pro tools setup (Bookings/Inquiry/Loyalty) — *post-MVP*
- `redmond-compass-pattern-screens-wireframe.html` — Events, Saved, Account, Community, Resources

## Coverage

Every screen is specified: consumer **S1–S8**, content (Community, Resources), business **B0–B9**. Screens marked *post-MVP* are designed-ahead so they switch on later as a config change, not a redesign — they are **not** part of the v1 build.

## How to use it

### → Claude Design (hi-fi visuals)
1. Provide `design-tokens.css` and the wireframe HTML files.
2. Ask it to produce high-fidelity screens that follow the wireframe layouts and the token system.
3. Hold the line on the principles: **no star-rating UI, no featured/promoted slots, free listings look complete.**

### → Claude Code (build)
1. Provide `BUILD-BRIEF.md`, `design-tokens.css`, and the wireframes.
2. Follow the build sequence in `BUILD-BRIEF.md` §12.
3. Code against the swappable data layer (§2, §5) so the backend decision (base44 API vs a shared backend) doesn't block frontend work.

## The one decision to make first
**Data source:** does the app read from base44's API, or from a shared backend (e.g. Supabase) that both the app and main site use? See `BUILD-BRIEF.md` §2. Everything else can proceed in parallel.

## Note
Designed from the current site's information architecture; the live site is client-rendered, so listings weren't directly inspectable. Confirm the free-listing field set against the real base44 schema when wiring data.
