# Sheet ↔ Supabase id reconciliation (2026-07-23)

**Purpose:** the sync upserts on the Sheet's `id` (= `businesses.id`). If a Sheet `id`
doesn't match the existing Supabase row, the first run **inserts a duplicate** instead
of updating in place. This is the pre-flight that guarantees run #1 is a clean in-place
update, not a doubling of the directory.

## What was compared

| Side | Source | Rows |
|---|---|---|
| Supabase (staging = hosted `jdrhcmkqtewlzlojixpd`) | `public.businesses`, published, read via anon+RLS | **132** |
| Sheet | "Redmond Compass Business Directory Backup - 2026-07-05" (`1n-o0xlVbo8x5r3y2vT_mGVWigem3YWdCzv3JNaC0_Vk`), `Businesses` tab, `Business ID` column | **132** |

Both keyed by Base44 ObjectId (130× 24-hex, 2× `b44s_…`). The Sheet is literally the
export the Supabase rows were imported from, so the overlap is near-total.

> **Verify before pasting:** this assumes the sync's `SHEET_ID` points at file
> `1n-o0xlVbo8x5r3y2vT_mGVWigem3YWdCzv3JNaC0_Vk`. If the live sync targets a *different*
> copy (reordered/added rows), the row-ordered id column below won't line up — say so and
> I'll re-key against that file.

## Match report

- **129 / 132 exact id matches, with 0 name mismatches.** Already aligned — no action.
- **3 businesses exist on both sides under *different* ids** (same business, id drift):

  | Sheet row | Business | Sheet `Business ID` | Supabase `id` (canonical) |
  |---|---|---|---|
  | 17 | Alpenglow Films | `6a3c8981fc8d09ae88bad4d7` | `b44s_de5e941cf0769ad4221b` |
  | 38 | Wilson's of Redmond | `6a375b33e107f11c06233777` | `6a4be6a8b1608afc036d6fd8` |
  | 75 | Beland Tax & Notary Services | `6a23605420f0faf58dcce3f0` | `b44s_0c7d816a94db7cdb03ca` |

- **0 blank ids, 0 duplicate ids** in the Sheet.
- Left uncorrected, run #1 would **insert 3 unclaimed duplicates** and leave the 3 real
  rows as orphans (their `synced_at` is null, so the soft-unpublish never touches them —
  you'd see two of each in the directory).

### Why this is not cosmetic — Wilson's is claimed

Two Supabase rows are **owner-claimed** (`owner_id` set):
`Preferred Mortgage – Alexandra Landeros` (matches exactly) and **`Wilson's of Redmond`
(`6a4be6a8…`) — one of the 3 drifted rows.** If the Sheet keeps `6a375b33…`, the sync
creates a *second, unclaimed* Wilson's and the owner's claimed listing orphans. Correcting
the id upserts into the claimed row and preserves the claim.

## Recommendation — **(a) align the Sheet's ids to the existing Supabase ids.** ✅

Keep the Supabase ids as canonical; fix the 3 drifted cells in the Sheet.

**Why (a) over (b):**
- 129/132 already match — (a) is a **3-cell edit**; (b) rewrites all 132 for no benefit.
- The Supabase ids are load-bearing. `businesses.id` (text) is FK-referenced, mostly
  `ON DELETE CASCADE`, by: `bulletins`, `events`, `recommendations`,
  `business_classes`, and (`SET NULL`) `profiles.owner_business_id` — plus the
  un-enforced `profiles.saved_business_ids[]` / `followed_business_ids[]` arrays, and the
  `owner_id`/`claimed` claim link. What (b) — fresh ids + clearing the seed rows — would
  destroy **right now**:
  - **2 owner claims** (`owner_id`) severed; the sync cannot restore `owner_id`.
  - **10 `business_classes`** rows (all under `6a381e3b…`) cascade-deleted.
  - any saved/followed lists silently point at dead ids.
  - and because `synced_at` is null on all 132, the old rows wouldn't even auto-unpublish —
    (b) yields ~132 duplicates **plus** ~132 orphans.
- (a) preserves every id, claim, and reference; the first sync is a pure in-place update.

**Post-correction sanity (verified):** after the 3 fixes, all 132 Sheet ids map 1:1 into
Supabase, all 132 Supabase ids are covered, **0 rows would insert new.**

## Paste-ready id column (path a, Sheet row order)

- `redmond-sheet-id-column.txt` — a header (`id`) + 132 ids in exact Sheet row order.
  Paste down the `id` column (see the owner setup packet for the rename/range steps). 129
  values are unchanged; the 3 above are corrected.
- `redmond-sheet-id-audit.csv` — `sheet_row, name, current_business_id, canonical_id,
  changed` for all 132, so every change is auditable. Only rows 17/38/75 show `changed=YES`.

If you'd rather touch only what changed: leave the `Business ID` values as-is and edit just
those 3 cells to the canonical id in the table above — same result.
