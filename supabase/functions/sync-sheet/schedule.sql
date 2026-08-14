-- Schedule the sync-sheet edge function — DAILY at 08:15 UTC (sheet-sync-spec §1).
--
-- SHIPS IN DRY-RUN MODE (`&dry=1`): the job computes the plan and writes NOTHING until the
-- Sheet's 3 drifted Business IDs are corrected. Going live is a separate deliberate step —
-- see "GOING LIVE" near the bottom. Do not remove &dry=1 as part of setup.
-- NOT a migration — run once by hand in the SQL editor AFTER the function is deployed and
-- its secrets are set, because it hard-codes the project ref + a service-role bearer.
-- Needs pg_cron + pg_net (Dashboard → Database → Extensions).
--
--   supabase secrets set SHEET_ID=… GOOGLE_SERVICE_ACCOUNT="$(cat sa.json)" DEPLOY_HOOK_URL=…
--   supabase functions deploy sync-sheet
--   then run this file's body, substituting <REF> and <SERVICE_ROLE_KEY>.
--
-- ── Cadence & DST — read this before "fixing" the time ─────────────────────────────────
-- The owner refreshes the Sheet weekly, ~Sunday 11:59pm Pacific, and we want the sync to land
-- JUST AFTER that. pg_cron runs in **UTC and does NOT observe DST**, so a fixed UTC time drifts
-- by one hour in Pacific wall-clock across the year — that drift is EXPECTED, not a bug. We pick
-- the UTC time that stays just-after in BOTH halves of the year:
--
--   Sun 23:59 Pacific update, converted to UTC:   PDT (summer, UTC−7) = Mon 06:59 UTC
--                                                 PST (winter, UTC−8) = Mon 07:59 UTC
--   08:15 UTC fires after the later of those, so it is just-after in both:
--     • PST (winter): 08:15 UTC = Mon 00:15 PST  → ~16 min after the update
--     • PDT (summer): 08:15 UTC = Mon 01:15 PDT  → ~76 min after the update
--
--   (07:15 UTC would be 44 min EARLY in PST — 23:15 Sun, before the 23:59 update — so we don't
--   use it; at 08:15 the Monday-morning directory always reflects the Sunday-night update.)
--
-- The daily cadence also does the "keep checking until a change appears" job: most days the
-- Sheet is unchanged and the run is a cheap no-op log. Whether a run triggers a host REBUILD is
-- decided inside the function (deploy hook + debounce) — see index.ts. NOTE: as currently
-- written the function fires the deploy hook on every successful run (it treats an all-rows
-- upsert as "changed"), so a daily cron rebuilds daily. Gate the hook on a real content diff if
-- daily no-op rebuilds are undesirable.
-- ───────────────────────────────────────────────────────────────────────────────────────

-- ── x-sync-secret is now MANDATORY ─────────────────────────────────────────────────────
-- The function's gate is fail-closed as of the slug/secret fix: no `x-sync-secret` header,
-- or a wrong one, returns 403; an UNSET secret on the function returns 503. A cron job that
-- posts without the header does not "mostly work" — it fails every single night, silently,
-- because nobody reads cron output.
--
-- The function reads SYNC_SECRET from its Deno environment (`supabase secrets set`).
-- Postgres CANNOT read those — pg_cron/pg_net run inside the database, which has no access
-- to Function secrets. So the same value has to be reachable from SQL, and Vault is where
-- this project keeps it: encrypted at rest, and the cron command stores only a NAME rather
-- than the secret itself. That matters because `cron.job.command` is plain text readable by
-- anyone who can query it — inlining would put both the service-role key and the sync
-- secret in a table.
--
-- ONE-TIME SETUP (SQL editor, once — the values must match what the function has):
--
--   select vault.create_secret('<SYNC_SECRET>',      'sync_secret',           'sync-sheet shared secret');
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'sync_service_role_key', 'sync-sheet cron bearer');
--
--   -- to rotate later (no need to touch the cron job — it reads by name):
--   select vault.update_secret((select id from vault.secrets where name = 'sync_secret'), '<NEW>');
--
-- If Vault is unavailable, see the INLINE FALLBACK at the bottom of this file.
-- ───────────────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ⚠️ SHIPS IN DRY-RUN MODE — `&dry=1` is DELIBERATE, do not remove it to "finish setup".
-- The job computes the full plan nightly and writes NOTHING: no upsert, no soft-unpublish,
-- no deploy hook, not even a sync_runs row. Going live is a separate, deliberate act by the
-- owner — see "GOING LIVE" below. It must not happen as a side effect of merging or of
-- running this file.
select cron.schedule(
  'sync-sheet-daily',
  '15 8 * * *',                          -- 08:15 UTC daily (UTC-only; see DST note above)
  $$
  select net.http_post(
    url     := 'https://<REF>.supabase.co/functions/v1/sync-sheet?trigger=schedule&dry=1',
    headers := jsonb_build_object(
      -- Service-role bearer (NOT anon): a trusted server-to-server invocation.
      'Authorization',  'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'sync_service_role_key'),
      'Content-Type',   'application/json',
      -- REQUIRED. Without this the function returns 403 and the sync never runs.
      'x-sync-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret')
    ),
    timeout_milliseconds := 30000          -- headroom for Google auth + sheet fetch + upserts
  );
  $$
);

-- ── VERIFY WITHOUT FIRING IT ────────────────────────────────────────────────────────────
-- Confirms the job would construct a correct request, without invoking the function.
--
-- 1) Both secrets exist and are readable (expect both_secrets_present = true):
--
--   select
--     (select count(*) from vault.decrypted_secrets
--       where name in ('sync_secret','sync_service_role_key')) = 2 as both_secrets_present;
--
-- 2) Preview the exact URL/method/headers the job builds, with the values MASKED — this
--    evaluates the same expressions the cron command uses, so a missing or misnamed Vault
--    entry shows up here as an empty value rather than as a silent 403 at 08:15:
--
--   select
--     'POST' as method,
--     'https://<REF>.supabase.co/functions/v1/sync-sheet?trigger=schedule&dry=1' as url,  -- mirror the job
--     jsonb_build_object(
--       'Authorization', 'Bearer ' || left(coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'sync_service_role_key'), ''), 8) || '…',
--       'Content-Type',  'application/json',
--       'x-sync-secret', left(coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret'), ''), 8) || '…'
--     ) as headers_preview;
--
-- 3) Confirm the SCHEDULED job actually carries the header (guards against re-running an
--    older copy of this file — expect sends_sync_secret = true):
--
--   select jobname, schedule, active,
--          command like '%x-sync-secret%' as sends_sync_secret
--     from cron.job where jobname = 'sync-sheet-daily';
--
-- 4) After the first real firing, read what the function actually answered — pg_net stores
--    every response, so you never have to guess:
--
--   select r.status_code, r.content, r.created
--     from net._http_response r order by r.created desc limit 5;
--
--   403 → the header is missing/wrong (check step 3, then that Vault matches the function's
--         SYNC_SECRET).  503 → SYNC_SECRET is not set ON THE FUNCTION.  200 → ran.

-- ── GOING LIVE — a deliberate, separate action ──────────────────────────────────────────
-- The job above ships with `&dry=1` and stays that way until a human removes it. It is NOT
-- a setup step to complete; it is a hold.
--
-- WHY THE HOLD EXISTS: three Business ID cells in the Sheet still carry ids that don't match
-- Supabase (see RECONCILIATION-2026-07-23.md). A real run today would insert 3 duplicate
-- listings and orphan Wilson's owner-claimed listing. As of the last dry run the Sheet is
-- still uncorrected — `newIds: 3`.
--
-- Watch it without touching anything. The nightly dry run's full response is in
-- net._http_response (query 4 above); newIds is the number to watch:
--
--   select (r.content::jsonb)->'newIds'->>'count' as new_ids,
--          (r.content::jsonb)->'wouldUnpublish'->>'total' as would_unpublish,
--          r.status_code, r.created
--     from net._http_response r
--    where r.content::jsonb ? 'dryRun'
--    order by r.created desc limit 7;
--
-- RELEASE THE HOLD only when that reads new_ids = 0 (and would_unpublish is a number you
-- have consciously accepted). Then re-schedule WITHOUT `&dry=1`:
--
--   select cron.unschedule('sync-sheet-daily');
--   -- then re-run this file's cron.schedule block with `&dry=1` removed from the url
--
-- Confirm which mode is actually scheduled at any time:
--
--   select jobname,
--          case when command like '%dry=1%' then 'DRY RUN (writes nothing)'
--               else 'LIVE (writes to businesses)' end as mode
--     from cron.job where jobname = 'sync-sheet-daily';

-- To change the time:  select cron.unschedule('sync-sheet-daily');  then re-run with a new cron.
-- To remove:           select cron.unschedule('sync-sheet-daily');

-- ── INLINE FALLBACK (only if Vault is unavailable) ──────────────────────────────────────
-- Functionally identical, but stores BOTH secrets as plain text in cron.job.command. Prefer
-- the Vault form above; if you use this, treat `cron.job` as secret-bearing.
--
--   select cron.schedule('sync-sheet-daily', '15 8 * * *', $$
--     select net.http_post(
--       -- keep &dry=1 here too; the hold applies to this form identically
--       url     := 'https://<REF>.supabase.co/functions/v1/sync-sheet?trigger=schedule&dry=1',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--         'Content-Type',  'application/json',
--         'x-sync-secret', '<SYNC_SECRET>'
--       ),
--       timeout_milliseconds := 30000
--     );
--   $$);
