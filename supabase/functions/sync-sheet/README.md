# sync-sheet — legacy Google Sheet → Supabase recovery importer

This guarded importer is retained for recovery and controlled one-off imports. It is **not
the production source or scheduler** as of 2026-09-02: published business data now mirrors
the main site's public directory through `.github/workflows/business-sync.yml` every six
hours. Do not schedule this Sheet importer concurrently; two writers would overwrite each
other according to run order rather than a defined source precedence.

## 1. Sheet setup (makes or breaks the sync)

- **`id` column — stable, unique, never reused.** This is the upsert key
  (`= businesses.id`). Renaming a business must NOT change its `id`; a deleted
  row's `id` is never recycled. Use `RC-0001`-style ids or the existing row ids.
  **Align sheet ids with the ids already in `businesses`** (the sheet is the
  Base44 export artifact, so most already match) to avoid creating duplicates.
- **Locked header row** (order doesn't matter — parsed by name, case-insensitive).
  Required: `id, name, category, published`. Optional/mapped: `subcategories,
  description, address, phone, website, email, hours, image, notes`. Header aliases
  (`transform.ts` `HEADER_ALIASES`) accept the Base44 export's spelling — currently
  `Business ID` → `id`.
- **`published`** (TRUE/FALSE) — draft rows (FALSE/blank) never ship.
- **`category`** — a data-validation dropdown matching the app taxonomy.
- **`image`** — a *filename* in the Supabase Storage `business-media` bucket
  (images do NOT live in the sheet). Workflow: upload to the bucket → paste the
  filename. Blank `image` leaves existing photos untouched.
- **`hours`** — editors may keep using readable weekly prose. Recognized day ranges,
  daily hours, overnight closing, and explicit closed days are converted to the canonical
  seven-day schedule while the original wording remains in `hours_text`. Unmentioned days
  in a clear weekly schedule are recorded as closed. Appointment-only, seasonal,
  sold-out-dependent, conflicting, and multi-service/multi-interval text remains prose so
  the app never makes a false Open/Closed claim. If clear hours become ambiguous or are
  removed, the old generated schedule is cleared instead of becoming stale. Existing
  claimed-owner canonical hours always win.
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

## 3. Deploy + manual recovery use

```
supabase functions deploy sync-sheet
# Do not install schedule.sql while business-sync.yml is active.
```

Trigger a one-off run to verify: `POST /functions/v1/sync-sheet` (add the
`x-sync-secret` header if `SYNC_SECRET` is set). Check the `sync_runs` table.

## 4. Safety (built in)

- Missing required header, empty sheet, or auth failure → **abort**, previous
  data left intact (nothing partially written).
- Row-level problems (blank name, duplicate id, unparseable phone) → skip/log,
  never fatal.
- Hours parsing is conservative and observable: dry runs report text rows, parsed rows,
  owner/editor schedules preserved, and rows intentionally left unstructured.
- Rows that leave the sheet → `published = false` (soft-unpublish). **Never a
  hard delete.** Only rows the sync has touched before are auto-unpublished, so
  owner-created listings are never affected.
- Every run is logged to `sync_runs` (rows read/upserted/unpublished, errors,
  deploy-hook fires). The deploy hook is debounced to ≤1×/hour.
- No ranking/boost field is ever written — ordering stays neutral.

Pure sheet→row logic is in `transform.ts`, unit-tested by
`scripts/sync-sheet-test.mjs` (`node scripts/sync-sheet-test.mjs`).
