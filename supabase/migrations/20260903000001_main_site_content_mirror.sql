-- The public Redmond Compass site is the sole intake and moderation surface for owner
-- content. Supabase stores a read-only mirror for the app; service-role sync jobs are the
-- only writers. Existing app-authored records are retained but can no longer diverge.

alter table public.bulletins
  add column if not exists title text,
  add column if not exists gallery_images jsonb not null default '[]'::jsonb,
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists source_updated_at timestamptz;

alter table public.events
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists source_time_text text,
  add column if not exists source_updated_at timestamptz;

alter table public.business_classes
  add column if not exists source text,
  add column if not exists source_id text,
  add column if not exists source_updated_at timestamptz;

create unique index if not exists bulletins_source_identity_idx
  on public.bulletins (source, source_id) where source is not null and source_id is not null;
create unique index if not exists events_source_identity_idx
  on public.events (source, source_id) where source is not null and source_id is not null;
create unique index if not exists business_classes_source_identity_idx
  on public.business_classes (source, source_id) where source is not null and source_id is not null;

comment on column public.bulletins.source is 'External publication authority; main_site rows mirror approved BusinessPost records.';
comment on column public.events.source is 'External publication authority; main_site rows mirror approved Event records.';
comment on column public.business_classes.source is 'External publication authority; main_site rows mirror approved BusinessClass records.';

drop policy if exists bulletins_insert on public.bulletins;
drop policy if exists bulletins_update on public.bulletins;
drop policy if exists bulletins_delete on public.bulletins;
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
drop policy if exists business_classes_insert on public.business_classes;
drop policy if exists business_classes_update on public.business_classes;
drop policy if exists business_classes_delete on public.business_classes;

revoke insert, update, delete on public.bulletins from authenticated;
revoke insert, update, delete on public.events from authenticated;
revoke insert, update, delete on public.business_classes from authenticated;
