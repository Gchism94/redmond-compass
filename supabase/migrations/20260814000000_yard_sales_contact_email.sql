-- Close the yard_sales.contact_email exposure (audit follow-up, 2026-08-14).
--
-- THE BUG: RLS gates ROWS, not COLUMNS. `yard_sales_read` restricts anon to
-- `status = 'approved'` rows, which reads like the table is protected — but the
-- accompanying `grant select on public.yard_sales to anon, authenticated` covers
-- EVERY column, so `?select=contact_email` returns the submitter's email address for
-- any approved row. Verified against the live table: the request returns 200, not 403.
-- It is empty today only because the table has 0 rows; the leak arms itself the moment
-- the first sale is approved.
--
-- The schema's own comment ("admin contact only; Phase 2 submit flow must not render it
-- publicly") describes a UI convention. A UI convention cannot protect a column that the
-- REST API will hand out on request — the browser is not the only client.
--
-- THE FIX: drop the table-wide grant and re-grant column-by-column, omitting
-- contact_email. Privileges now match the intent instead of relying on callers to be
-- polite. service_role keeps `grant all privileges` from the parity migration, so admin
-- and the sync are unaffected.
--
-- NOTE FOR WHOEVER BUILDS THE YARD-SALES UI: with column-level grants, `select=*` fails
-- CLOSED with 403 rather than silently omitting the column — Postgres requires
-- privileges on every column that `*` expands to. Name the columns explicitly:
--   ?select=id,title,category,location,start_date,end_date,start_time,end_time,description,image_url,status,created_at
-- That is the intended behaviour: a loud 403 beats a silent leak, and it means a future
-- `select=*` cannot quietly start returning contact_email again.

revoke select on public.yard_sales from anon, authenticated;

grant select (
  id, title, category, location,
  start_date, end_date, start_time, end_time,
  description, image_url, status, created_at
) on public.yard_sales to anon, authenticated;

-- contact_email is deliberately absent above. If a column is added to this table later,
-- it must be added here too or it will be unreadable — that default is correct: new
-- columns should have to opt IN to public visibility, not out of it.
