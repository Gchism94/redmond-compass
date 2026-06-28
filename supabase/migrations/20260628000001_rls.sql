-- ============================================================================
-- RLS + entitlement enforcement (mirrors src/lib/entitlements.ts at the DB).
--   • Public READ on all five content types (+ recommendations count).
--   • Owner WRITES gated by ownership AND tier.
--   • recommendations: insert-only by the authed user, positive-only (no value col).
-- ============================================================================

-- Role privileges (RLS then restricts rows). Readers = anon; owners = authenticated;
-- service_role (server-side: seed, GHL sync, admin) bypasses RLS and gets full access.
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

-- ---------- helpers ----------
create or replace function public.is_business_owner(b_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.businesses where id = b_id and owner_id = auth.uid());
$$;

-- Entitlement gate: tier decides which FIELDS an owner may write (free = parity set).
create or replace function public.enforce_business_entitlements()
returns trigger language plpgsql set search_path = public as $$
declare photo_cap int;
begin
  -- enhancedProfile (story/menu/gallery/ctas/owner_spotlight) is Member+ only
  if new.tier = 'free' then
    if new.story is not null
       or new.owner_spotlight is not null
       or new.menu is not null
       or new.ctas is not null
       or coalesce(array_length(new.gallery, 1), 0) > 0 then
      raise exception 'Enhanced profile (story/menu/gallery/CTAs) requires Member tier';
    end if;
  end if;
  -- photo cap: free = 5, member/pro = unlimited (LIMITS)
  photo_cap := case new.tier when 'free' then 5 else 2147483647 end;
  if coalesce(array_length(new.photos, 1), 0) > photo_cap then
    raise exception 'Free tier allows at most % photos', photo_cap;
  end if;
  return new;
end $$;
create trigger trg_business_entitlements
  before insert or update on public.businesses
  for each row execute function public.enforce_business_entitlements();

-- Free monthly bulletin cap: a capped LIVE post is blocked (the app offers to
-- SCHEDULE it free for the reset date — scheduled status bypasses the live cap).
create or replace function public.enforce_bulletin_cap()
returns trigger language plpgsql set search_path = public as $$
declare b_tier text; used int; cap int := 3;
begin
  select tier into b_tier from public.businesses where id = new.business_id;
  if b_tier = 'free' and new.status = 'live' then
    select count(*) into used from public.bulletins
      where business_id = new.business_id and status = 'live'
        and date_trunc('month', created_at) = date_trunc('month', now());
    if used >= cap then
      raise exception 'Free monthly bulletin cap reached (% live) — schedule for the reset date instead', cap;
    end if;
  end if;
  return new;
end $$;
create trigger trg_bulletin_cap
  before insert on public.bulletins
  for each row execute function public.enforce_bulletin_cap();

-- Claim an UNCLAIMED listing (owner_id is null) for the signed-in user. Needed
-- because the owner-update policy requires an existing owner = auth.uid(), which a
-- null-owner row can't satisfy. Definer-rights, but only claims when truly unowned.
create or replace function public.claim_business(b_id text)
returns public.businesses language plpgsql security definer set search_path = public as $$
declare row public.businesses;
begin
  if auth.uid() is null then raise exception 'Sign in to claim a listing'; end if;
  update public.businesses set claimed = true, owner_id = auth.uid()
    where id = b_id and owner_id is null
    returning * into row;
  if row.id is null then raise exception 'Listing not found or already claimed'; end if;
  return row;
end $$;
grant execute on function public.claim_business(text) to authenticated;

-- Positive-only count: each recommendation bumps the cached count (can only rise).
create or replace function public.bump_recommend_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.businesses set recommend_count = recommend_count + 1 where id = new.business_id;
  return new;
end $$;
create trigger trg_recommend_count
  after insert on public.recommendations
  for each row execute function public.bump_recommend_count();

-- ---------- enable RLS ----------
alter table public.businesses     enable row level security;
alter table public.bulletins      enable row level security;
alter table public.events         enable row level security;
alter table public.news_articles  enable row level security;
alter table public.resources      enable row level security;
alter table public.recommendations enable row level security;

-- ---------- BUSINESSES ----------
create policy businesses_read   on public.businesses for select using (true);  -- complete free listings to everyone
create policy businesses_insert on public.businesses for insert to authenticated
  with check (auth.uid() = owner_id and tier = 'free');                         -- new listings start free
create policy businesses_update on public.businesses for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy businesses_delete on public.businesses for delete to authenticated
  using (auth.uid() = owner_id);

-- ---------- BULLETINS ----------
create policy bulletins_read   on public.bulletins for select
  using (status = 'live' or public.is_business_owner(business_id));             -- drafts/scheduled only to the owner
create policy bulletins_insert on public.bulletins for insert to authenticated
  with check (public.is_business_owner(business_id));
create policy bulletins_update on public.bulletins for update to authenticated
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy bulletins_delete on public.bulletins for delete to authenticated
  using (public.is_business_owner(business_id));

-- ---------- EVENTS ----------
create policy events_read   on public.events for select using (true);
create policy events_insert on public.events for insert to authenticated
  with check (business_id is not null and public.is_business_owner(business_id));
create policy events_update on public.events for update to authenticated
  using (business_id is not null and public.is_business_owner(business_id))
  with check (business_id is not null and public.is_business_owner(business_id));
create policy events_delete on public.events for delete to authenticated
  using (business_id is not null and public.is_business_owner(business_id));

-- ---------- NEWS + RESOURCES (public read; writes via service role only) ----------
create policy news_read      on public.news_articles for select using (true);
create policy resources_read on public.resources     for select using (true);

-- ---------- RECOMMENDATIONS (insert-only by the authed user; public count) ----------
create policy recommendations_read   on public.recommendations for select using (true);
create policy recommendations_insert on public.recommendations for insert to authenticated
  with check (auth.uid() = user_id);
-- intentionally NO update/delete policies → insert-only, positive-only.
