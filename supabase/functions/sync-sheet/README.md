# sync-sheet — Google Sheet → Supabase (operator guide)

The Google Sheet is the **source of truth** for directory data (GHL is out of the
path). This function pulls it into `public.businesses` on a schedule. The code is
done and unit-tested; the steps below are the **human setup** that has to happen
with Greg before it can run.

## 1. Sheet setup (makes or breaks the sync)

- **`id` column — stable, unique, never reused.** This is the upsert key
  (`= businesses.id`). Renaming a business must NOT change its `id`; a deleted
  row's `id` is never recycled. Use `RC-0001`-style ids or the existing row ids.
  **Align sheet ids with the ids already in `businesses`** (the sheet is the
  Base44 export artifact, so most already match) to avoid creating duplicates.
- **Locked header row** (order doesn't matter — parsed by name). Required:
  `id, name, category, published`. Optional/mapped: `subcategories, description,
  address, phone, website, email, hours, image, notes`.
- **`published`** (TRUE/FALSE) — draft rows (FALSE/blank) never ship.
- **`category`** — a data-validation dropdown matching the app taxonomy.
- **`image`** — a *filename* in the Supabase Storage `business-media` bucket
  (images do NOT live in the sheet). Workflow: upload to the bucket → paste the
  filename. Blank `image` leaves existing photos untouched.
- **`notes`** — internal editor notes; ignored by the sync.
- A **`_README` tab** documenting all of the above for future editors.
- Give the Google **service account** (below) Viewer access to the Sheet.

## 2. Secrets (never in the repo or the sheet)

```
supabase secrets set \
  SHEET_ID="<spreadsheet id>" \
  SHEET_RANGE="Businesses!A:Z" \
  GOOGLE_SERVICE_ACCOUNT="$(cat service-account.json)" \
  DEPLOY_HOOK_URL="<host build hook, Phase 3>"   # optional; skipped if unset
# optional shared secret for a manual/Apps-Script trigger:
supabase secrets set SYNC_SECRET="<random>"
```

Create the service account in Google Cloud → IAM → Service Accounts, enable the
**Google Sheets API**, download a JSON key, and share the Sheet with its
`client_email` (read-only).

## 3. Deploy + schedule

```
supabase functions deploy sync-sheet
# then, once: run supabase/functions/sync-sheet/schedule.sql in the SQL editor
# (substitute <REF> and <ANON_KEY>) to run it every 15 minutes via pg_cron.
```

Trigger a one-off run to verify: `POST /functions/v1/sync-sheet` (add the
`x-sync-secret` header if `SYNC_SECRET` is set). Check the `sync_runs` table.

## 4. Safety (built in)

- Missing required header, empty sheet, or auth failure → **abort**, previous
  data left intact (nothing partially written).
- Row-level problems (blank name, duplicate id, unparseable phone) → skip/log,
  never fatal.
- Rows that leave the sheet → `published = false` (soft-unpublish). **Never a
  hard delete.** Only rows the sync has touched before are auto-unpublished, so
  owner-created listings are never affected.
- Every run is logged to `sync_runs` (rows read/upserted/unpublished, errors,
  deploy-hook fires). The deploy hook is debounced to ≤1×/hour.
- No ranking/boost field is ever written — ordering stays neutral.

Pure sheet→row logic is in `transform.ts`, unit-tested by
`scripts/sync-sheet-test.mjs` (`node scripts/sync-sheet-test.mjs`).
