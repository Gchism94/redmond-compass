-- ============================================================================
-- PROFILES — per-user personalization, persisted server-side (BUILD-BRIEF §12 step 6).
--   • One row per auth user (id = auth.users.id), auto-created on signup.
--   • Holds the local-first prefs (saved / followed / saved-events / recently-viewed
--     / interests / notification prefs / location / onboarded). On first sign-in the
--     app MERGES the guest's localStorage prefs into this row so nothing is lost.
--   • RLS: a user may read/write ONLY their own row. No anon access (private data).
--   • owner_business_id is a convenience cache; the source of truth for ownership is
--     businesses.owner_id (RLS there gates writes). Kept in sync by the owner path.
-- This table holds NO content and NO rating/ranking columns — personalization only.
-- ============================================================================

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  saved_business_ids    text[]  not null default '{}',
  followed_business_ids text[]  not null default '{}',
  saved_event_ids       text[]  not null default '{}',
  recently_viewed_ids   text[]  not null default '{}',
  interests             text[]  not null default '{}',
  notification_prefs    jsonb   not null default '{"followedBulletins":true,"savedEvents":true,"localNews":false}'::jsonb,
  location              jsonb,                         -- { lat, lng } | null
  onboarded             boolean not null default false,
  owner_business_id     text references public.businesses (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Grants must be explicit: the blanket grants in the RLS migration ran BEFORE this
-- table existed. Readers (anon) get NOTHING here — profiles are private.
grant select, insert, update on public.profiles to authenticated;
grant all privileges on public.profiles to service_role;

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create an empty profile row when a new auth user signs up (definer-rights so
-- it can insert past RLS). The app then merges the guest's local prefs into it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS: own row only ----------
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (auth.uid() = id);
create policy profiles_update on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
-- intentionally NO delete policy and NO anon access.
