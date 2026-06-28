# Prompt — Claude Design

> Paste this into Claude Design. Attach: `design-tokens.css`, all `*-wireframe.html` files, and `redmond-compass-build-reference.html`.

---

You're designing high-fidelity screens for **Redmond Compass**, a mobile-first PWA — a hyperlocal business directory and community hub for Redmond, Oregon. I've attached the design system and the approved wireframes.

**Inputs:**
- `design-tokens.css` — the authoritative system (colors, type, spacing, radii, shadows). Build everything from these tokens; don't introduce new ones without telling me.
- The `*-wireframe.html` files — the approved layout and structure for each screen. Open them; several have state toggles you should design for.
- `redmond-compass-build-reference.html` — the overall model and principles.

**Visual direction:** clean, calm, editorial-but-functional. Fonts: **Playfair Display** (headings/display only) + **DM Sans** (everything functional — body, UI, buttons, labels, metadata), matching the live site. Color: amber `#C86604` = primary CTAs; terracotta `#D76942` = accent/highlights; pine green `#2E6049` = positive / "open now" / links / focus; deep navy `#082954` = text; warm cream `#FAF8F5` = background; white = cards. `design-tokens.css` is authoritative — it's **translated from the live redmondcompass.com site**, so the app keeps brand parity; the wireframe colors/fonts were placeholders, ignore them. Mobile frame ~390px. Good contrast, 44px tap targets.

**Non-negotiable principles — do not violate:**
- No star ratings or 1–5 score UI anywhere. Reputation is positive-only ("recommended by N locals") plus factual badges (verified, posts weekly, replies in a day).
- No "featured," "sponsored," or "promoted" slots. Feeds and results are organic.
- Free business listings must look complete — never crippled, never visibly "locked."

**Deliverables, in this order:**
1. **A component sheet first** — ResultCard, sticky ActionBar (Call · Directions · Save · Follow), BottomTabNav, chips/pills, toggles, section headers with "see all", empty states, status badges, completeness meter — all derived from the tokens.
2. **MVP screens at hi-fi:** Business Profile (S5), Search + Results (S3/S4), Home (S2), Events (S6), Saved (S7), Account (S8), Community/News, Resources, and the free Edit Listing (B4).
3. **Key states** per screen — e.g. Home personalized vs cold-start; Results list vs no-results; Edit Listing basic (MVP).

Match the wireframe layouts and elevate them visually. Ask me before inventing any screen or component that isn't in the wireframes.
