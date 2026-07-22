-- Schedule the sync-sheet edge function every 15 minutes (sheet-sync-spec §1).
-- NOT a migration — run once by hand (or via the dashboard) AFTER the function is
-- deployed and its secrets are set, because it hard-codes the project ref + a key.
-- Needs the pg_cron + pg_net extensions (enable in Dashboard → Database → Extensions).
--
--   supabase secrets set SHEET_ID=… GOOGLE_SERVICE_ACCOUNT="$(cat sa.json)" DEPLOY_HOOK_URL=…
--   supabase functions deploy sync-sheet
--   then run this file's body in the SQL editor, substituting <REF> and <ANON_KEY>.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- every 15 minutes
select cron.schedule(
  'sync-sheet-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://<REF>.supabase.co/functions/v1/sync-sheet',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <ANON_KEY>',
      'Content-Type',  'application/json'
    )
  );
  $$
);

-- Nightly backstop build at 03:10 (fires the deploy hook regardless of debounce is
-- handled inside the function; this simply guarantees a fresh static build daily).
-- Point this at a tiny wrapper or the host's own scheduled build instead if preferred.

-- To remove:  select cron.unschedule('sync-sheet-15min');
