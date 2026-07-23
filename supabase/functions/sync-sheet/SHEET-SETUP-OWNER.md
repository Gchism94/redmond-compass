# Redmond Compass — Business Directory Sheet setup (for the owner)

This Google Sheet is the **source of truth** for the app's business directory. Every 15
minutes the app reads this Sheet and updates the directory to match. You edit the Sheet;
the app follows. No code, no logins — just this Sheet.

The app connects with a Google **service account** that has **Viewer (read-only)** access.
It can *read* the Sheet but never edit it, so the Sheet stays fully yours to edit.

---

## The header row (row 1) — exact names

Use these column names in **row 1**, spelled exactly like this (lowercase). Order doesn't
matter, and extra columns you keep for your own notes are ignored.

| Column | Required? | What it means |
|---|---|---|
| `id` | **Yes** | The listing's permanent ID. Never change or reuse one. Your sheet's existing **`Business ID`** column already counts as this — leave it named that way if you like. |
| `name` | **Yes** | Business name, as shown in the directory. |
| `category` | **Yes** | The app category **slug** — e.g. `home-services`, `beauty-wellness`, `shopping`, `sports-fitness`, `food-drink`. Use the dropdown. |
| `published` | **Yes** | Checkbox. **Checked = visible** in the app. Unchecked/blank = hidden (draft). |
| `subcategories` | No | Extra tags, separated by semicolons — e.g. `Massage; Wellness`. |
| `description` | No | The short description shown on the listing. |
| `address` | No | Street address. |
| `phone` | No | Phone number (any format). |
| `website` | No | Full URL, including `https://`. |
| `email` | No | Contact email. |
| `hours` | No | Hours text — e.g. `Mon–Fri 9–5, Sat 10–2`. |
| `image` | No | A **file name** in the app's image storage (see "Images" below) — **not** a web link. Leave blank to keep the current photo. |
| `notes` | No | Your private notes. Ignored by the app. |

**The `published` checkbox:** to add a checkbox in Google Sheets, select the column →
*Insert ▸ Checkbox*. Check it for every listing that should be live.

---

## The two rules that matter

1. **Never rename or reuse an `id`.** Each listing keeps its `id` forever. If you retype an
   `id`, or give a new business an old business's `id`, the app **creates a duplicate** (the
   same business shows up twice). To retire a listing, **uncheck `published`** — don't reuse
   its id, and don't delete the row unless you mean it gone.
2. **Don't rename or delete the header row (row 1).** If a required header (`id`, `name`,
   `category`, `published`) is missing or misspelled, the **sync stops** and the directory
   simply keeps showing whatever it last had — nothing updates until row 1 is fixed. (This is
   deliberate: a broken header never wipes the live directory.)

Everything else is safe: reordering columns, sorting rows, fixing a typo, adding a business,
unchecking `published` — all fine.

---

## Images

Photos do **not** live in this Sheet. The `image` column holds a **file name** that exists in
the app's image storage (the `business-media` bucket). Workflow: upload the photo to the
bucket, then paste its file name (e.g. `trinity-bikes.jpg`) into `image`. **Leave `image`
blank to keep the listing's current photo** — blank never erases an existing image.

---

## _README tab (paste this verbatim into a tab named `_README`)

> **Redmond Compass — Business Directory**
>
> This sheet is the source of truth for the app's business directory. The app reads it
> automatically every 15 minutes and updates itself to match. Edit here; the app follows.
>
> **Tab:** the directory lives on the tab named `Businesses`. Don't rename it.
>
> **Row 1 is the header row. Required columns (case-insensitive):**
> `id`, `name`, `category`, `published`. The `id` column may be titled `id` or `Business ID` —
> both are accepted.
> **Optional columns:** `subcategories`, `description`, `address`, `phone`, `website`,
> `email`, `hours`, `image`, `notes`. Extra columns are ignored.
>
> **`id`** (a.k.a. `Business ID`) — each listing's permanent ID. NEVER change it and NEVER
> reuse an old one. Retyping or reusing an id creates a duplicate listing in the app.
>
> **`published`** — a checkbox. Checked = the listing is live in the app. Unchecked or blank =
> hidden (draft). To take a listing down, uncheck this box — do not delete the row or reuse
> its id.
>
> **`category`** — must be an app category slug (use the dropdown): e.g. `home-services`,
> `beauty-wellness`, `shopping`, `sports-fitness`, `food-drink`.
>
> **`image`** — a file NAME in the app's image storage (`business-media` bucket), not a web
> link. Blank keeps the current photo.
>
> **Two rules:** (1) never rename/reuse an `id` → prevents duplicates. (2) never change the
> header row → if a required column is missing, the sync stops and the live directory is left
> untouched until it's fixed.
>
> **Removing a listing:** uncheck `published`. The app hides it; it is never hard-deleted.
>
> Questions → Greg.

---

## One-time conversion of the current backup sheet

The current tab is the Base44 export ("…Backup - 2026-07-05"). Its headers already work: the
app matches them ignoring case (`Name`→`name`, `Category`→`category`, …) and accepts your
existing **`Business ID`** column as the `id` field. **The only structural change is one new
column:**

1. **Add a `published` checkbox column and check it for every current row** — they're all live
   today. (*Insert ▸ Checkbox*.) ⚠️ **Do NOT reuse `Profile Enabled` for this** — it's mostly
   "No" (it means "owner has an account"), so treating it as `published` would hide ~130
   businesses.

That's the only header change. Then one **data** fix (values, not headers):

2. **Correct 3 drifted `id` values.** Three listings have an id in the sheet that differs from
   the app's — edit those 3 cells in the `Business ID` column to the app's id (table in
   `RECONCILIATION-2026-07-23.md`: Alpenglow Films, **Wilson's of Redmond**, Beland Tax &
   Notary). Wilson's is owner-claimed; without the fix the sync creates a second, unclaimed
   Wilson's. *(Bulk option: paste `redmond-sheet-id-column.txt` over the whole column — its
   first line is `id`, so pasting from the header cell also renames `Business ID`→`id`, which
   is fine.)*

Everything else needs no action:
- `Name`, `Category`, `Address`, `Phone`, `Website`, `Email`, `Hours`, `Description` map as-is.
- **`Featured`** may stay in the Sheet — it simply **has no effect**. The app gives every
  listing equal ranking (no paid or boosted placement), so this column is never read and can
  never reach the app. Leave it or delete it; nothing changes either way.
- **`Image URL`** (the `media.base44.com` links) is **not** read, so existing photos stay put.
  Migrate images to the storage bucket later if you want app-hosted photos.

**For Greg (not the owner):** this sheet has **31 columns** — `Business ID` sits at column
**AE**. The sync's default read range `Businesses!A:Z` stops at column Z (26) and would miss
it. Set the secret **`SHEET_RANGE=Businesses!A:AZ`** so the id column is always in range.
Column position otherwise doesn't matter — parsing is by header name.
