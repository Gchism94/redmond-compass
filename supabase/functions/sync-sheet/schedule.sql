-- Schedule the sync-sheet edge function — DAILY at 08:15 UTC (sheet-sync-spec §1).
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

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-sheet-daily',
  '15 8 * * *',                          -- 08:15 UTC daily (UTC-only; see DST note above)
  $$
  select net.http_post(
    url     := 'https://<REF>.supabase.co/functions/v1/sync-sheet',
    headers := jsonb_build_object(
      -- Service-role bearer (NOT anon): a trusted server-to-server invocation. Keep this key
      -- secret — it lives only in the cron job definition (cron.job), never in the repo. For a
      -- hardened setup, store it in Vault and read vault.decrypted_secrets instead of inlining.
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'Content-Type',  'application/json'
      -- If you set the optional SYNC_SECRET, also send it (uncomment, incl. the leading comma):
      -- , 'x-sync-secret', '<SYNC_SECRET>'
    ),
    timeout_milliseconds := 30000          -- headroom for Google auth + sheet fetch + upserts
  );
  $$
);

-- To change the time:  select cron.unschedule('sync-sheet-daily');  then re-run with a new cron.
-- To remove:           select cron.unschedule('sync-sheet-daily');
