-- ============================================================================
-- Sheet → Supabase sync + account deletion (Stage 1, supersedes the GHL plan).
--
-- ARCHITECTURE CHANGE (2026-07-11): GoHighLevel is OUT of the data path. The
-- Google Sheet is the source of truth for directory data; a scheduled edge
-- function (`sync-sheet`) upserts it into `businesses`. GHL may live on as a
-- human-side CRM, but the platform never reads from it. `businesses.ghl_id`
-- is retained (harmless) but unused.
--
-- This migration adds only what the sync + deletion need; it is additive and
-- safe: every existing row defaults to published = true, so nothing disappears.
-- ============================================================================

-- ---------- businesses: publish flag + sync provenance ----------
alter table public.businesses
  add column if not exists published  boolean not null default true,
  -- set by the sync each run; NULL = never touched by the sync (owner-created or
  -- pre-sync import). The soft-unpublish step only ever touches synced rows, so
  -- owner-created listings are never auto-unpublished.
  add column if not exists synced_at  timestamptz;

create index if not exists businesses_published_idx on public.businesses (published);

-- Public read now hides unpublished listings; an owner still sees their own
-- (mirrors the events/bulletins "approved-or-owner" pattern). service_role
-- (the sync) bypasses RLS and can read/write regardless.
drop policy if exists businesses_read on public.businesses;
create policy businesses_read on public.businesses for select
  using (published = true or public.is_business_owner(id));

comment on column public.businesses.published is
  'Sheet-controlled visibility. Public read requires true; the sync sets it (soft-delete, never hard-delete).';
comment on column public.businesses.ghl_id is
  'Retired: GHL is out of the data path (2026-07-11). Column kept for history; unused.';

-- ---------- sync_runs: one row per sync-sheet execution (observability) ----------
create table if not exists public.sync_runs (
  id               bigint generated always as identity primary key,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  status           text not null default 'running'
                     check (status in ('running','success','partial','aborted','error')),
  trigger          text not null default 'schedule',       -- schedule | manual | apps_script
  rows_read        integer not null default 0,
  rows_upserted    integer not null default 0,
  rows_unpublished integer not null default 0,
  rows_skipped     integer not null default 0,             -- row-level failures (logged, not fatal)
  deploy_fired     boolean not null default false,
  message          text,
  errors           jsonb   not null default '[]'::jsonb    -- [{ row, reason }, ...]
);
create index if not exists sync_runs_started_idx on public.sync_runs (started_at desc);

-- RLS on, and NO anon/authenticated grants (the blanket grants in the RLS
-- migration ran before this table existed) ⇒ only service_role can touch it.
-- An admin surface later can read it with the service key or a dedicated policy.
alter table public.sync_runs enable row level security;
grant all privileges on public.sync_runs to service_role;

comment on table public.sync_runs is
  'Audit log for the sync-sheet edge function: rows read/upserted/unpublished, errors, deploy-hook fires.';
