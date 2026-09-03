-- Lossless public-field mirror for the owner-managed redmondcompass.com directory.
--
-- Base44/GHL remains authoritative. Supabase is the app's read model, so retain every
-- non-ranking field exposed by listBusinessesPublic even when the app does not render it
-- yet. `featured` is deliberately excluded: Redmond Compass promises equal directory
-- ranking and the app has no paid-placement column.

alter table public.businesses
  add column if not exists hide_address boolean not null default false,
  add column if not exists hours_location_name text,
  add column if not exists videos jsonb,
  add column if not exists headshot_url text,
  add column if not exists license_type text,
  add column if not exists referral_enabled boolean not null default false,
  add column if not exists referral_promo_code text,
  add column if not exists source_updated_at timestamptz;

comment on column public.businesses.source_updated_at is
  'updated_date from the authoritative redmondcompass.com Business record';

-- `profiles` predates the current Supabase default grants. Keep its documented
-- contract explicit even on projects where new tables inherit privileges for
-- `anon` and `authenticated`: guests get no table access, and signed-in users
-- only receive the operations protected by the own-row RLS policies.
revoke all privileges on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
