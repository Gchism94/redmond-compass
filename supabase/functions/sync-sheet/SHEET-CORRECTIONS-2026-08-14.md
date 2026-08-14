# Sheet corrections — Category column (2026-08-14)

**Purpose:** the Sheet is the single source of truth for `businesses.category`, and the
sync writes it verbatim. Four rows carry a category the app has no browse tile for, so
those businesses are only reachable via search and the "Everything else" catch-all. The
fix belongs in the Sheet, not in an app-side override — an override would make the app
disagree with its own source of truth, and the next sync would keep re-importing the
wrong value. Companion to `RECONCILIATION-2026-07-23.md`, which did the same for ids.

**What to change:** the **Category** cell only. Nothing else on these rows.
**Where:** the directory Google Sheet — find each row by its **Business ID**.
**Current value on all four rows:** `entertainment`
**Verified against:** the live `public.businesses` table on 2026-08-14 (133 rows) — every
id and current cell value below was read back before this list was written.

These four are tagged `entertainment`, which has no browse tile, so they currently
appear only under "Everything else" and are invisible to anyone browsing by category.
None of them is really an entertainment venue — they're a cafe/bar, two event-service
businesses, and an art class studio.

| # | Business name | Business ID | Category — current | Category — change to |
|---|---|---|---|---|
| 1 | Pangaea Guild Hall | `6a381b89373f46de1cd93f93` | `entertainment` | `food-drink` |
| 2 | Event Elegance | `6a3069353dee87b9c5060868` | `entertainment` | `services` |
| 3 | StrikingGlam PhotoBooth | `6a35d9b37c464f6b843555ec` | `entertainment` | `services` |
| 4 | Imaginary Rebel Art Studio | `6a381e3bd30e46405ad90476` | `entertainment` | `education` |

Values are lowercase with a hyphen, exactly as written above — they must match the
Sheet's existing spelling convention (`food-drink`, not `Food & Drink`).

## Why each one

1. **Pangaea Guild Hall** → `food-drink`
   A tabletop game hall, but also a cafe and cocktail bar serving breakfast, lunch and
   dinner with Thump espresso. Someone looking for it is looking for somewhere to eat.

2. **Event Elegance** → `services`
   Event rentals, décor and day-of coordination for weddings and corporate events.
   A service business, not a venue.

3. **StrikingGlam PhotoBooth** → `services`
   Photo booth rental for weddings, quinceañeras and parties. Also a service.

4. **Imaginary Rebel Art Studio** → `education`
   Paint parties, art classes, workshops and guided instruction. `education` puts it
   under the **Services** tile and makes it findable by people searching for classes.
   *This is the one judgement call of the four* — if you'd rather it read as an outing
   than a class, use `services` instead. Both land on the same Services tile, so the
   choice only affects wording, not where people find it.

## Not changing (deliberately)

These two are correctly tagged and stay where they are. They'll show under
"Everything else", which is now an accurate label rather than a catch-all pretending
to be a category:

| Business name | Business ID | Category | Why it stays |
|---|---|---|---|
| Redmond Community Concert Association | `6a3c8981fc8d09ae88bad4d8` | `entertainment` | Genuinely live entertainment — presenting concerts. |
| The Adventure Hub | `6a178d4ec13a0fe0a5e05219` | `lodging` | Short-term/vacation rentals. Correct, just has no tile yet. |

Schoolhouse Produce (`community-markets`) needed no Sheet edit — the app now rolls
markets up under **Retail**.

## After the edits

Once the Sheet is updated and the next sync runs, the browse tiles become:

```
Food & Drink   38   (+1)
Services       26   (+3)
Auto           21
Retail         18
Health         14
Home           12
Outdoors        2
Everything else 2   (was 7)
```

131 of 133 businesses reachable from a browse tile, up from 127.
