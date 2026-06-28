-- ============================================================================
-- Redmond Compass — Supabase schema (BUILD-BRIEF §2 + DATA-SOURCE.md, path B)
-- The app READS ONLY from Supabase. GoHighLevel sync is later (businesses.ghl_id
-- + a mapping stub) and must not block this.
--
-- PRINCIPLES ENFORCED AT THE DATA LAYER:
--   • No stars: there is NO rating/score/value column anywhere. Reputation is the
--     positive-only `recommendations` table (a count that can only rise).
--   • Equal ranking: there is NO boost/featured/rank/priority/sponsored column
--     anywhere. Ordering is relevance/distance/recency only (enforced in queries).
--   • Free listings are complete: public read returns whole rows; entitlements gate
--     only what an OWNER may WRITE (via RLS + tier triggers), never what a reader sees.
-- Column names are snake_case (Postgres); the DataSource maps them to the camelCase
-- shapes in src/lib/types.ts.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- BUSINESSES (the spine; authored in GHL → synced; or owner-created) ----------
create table public.businesses (
  id              text primary key default ('b_' || replace(gen_random_uuid()::text, '-', '')),
  name            text not null,
  slug            text not null unique,
  category        text not null,
  subcategories   text[] not null default '{}',
  description     text not null default '',
  address         text not null default '',
  lat             double precision,
  lng             double precision,
  phone           text,
  website         text,
  email           text,
  hours           jsonb,                         -- { week: {mon:{open,close,closed?}, ...}, special?: [] }
  photos          text[] not null default '{}',  -- free cap 5 (enforced by tier trigger)
  amenity_tags    text[] not null default '{}',
  claimed         boolean not null default false,
  verified        boolean not null default false,
  owner_id        uuid references auth.users (id) on delete set null,
  tier            text not null default 'free' check (tier in ('free','member','pro')),
  created_at      timestamptz not null default now(),
  member_since    timestamptz,
  -- DEFERRED (Member "enhanced profile") — writable only when tier <> 'free' (trigger)
  story           text,
  owner_spotlight jsonb,
  menu            jsonb,
  ctas            jsonb,
  gallery         text[],
  follower_count  integer,
  post_frequency  text check (post_frequency in ('weekly','monthly','occasional')),
  response_time   text,
  -- positive-only reputation count (NEVER a rating, NEVER used for ranking)
  recommend_count integer not null default 0,
  -- GHL system-of-record link (sync is later; nullable for Supabase-native/owner rows)
  ghl_id          text unique
);
create index businesses_category_idx on public.businesses (category);
create index businesses_owner_idx on public.businesses (owner_id);

-- ---------- BULLETINS (business posts) ----------
create table public.bulletins (
  id            text primary key default ('bl_' || replace(gen_random_uuid()::text, '-', '')),
  business_id   text not null references public.businesses (id) on delete cascade,
  body          text not null,
  image         text,
  link_cta      jsonb,                            -- { label, url }
  active_until  timestamptz,
  scheduled_for timestamptz,
  status        text not null default 'live' check (status in ('draft','scheduled','live','expired')),
  created_at    timestamptz not null default now()
);
create index bulletins_business_idx on public.bulletins (business_id);

-- ---------- EVENTS (community or business) ----------
create table public.events (
  id           text primary key default ('e_' || replace(gen_random_uuid()::text, '-', '')),
  business_id  text references public.businesses (id) on delete cascade,  -- null = community event
  title        text not null,
  description  text,
  start_at     timestamptz not null,
  end_at       timestamptz,
  venue_name   text,
  address      text,
  lat          double precision,
  lng          double precision,
  image        text,
  category     text,
  tags         text[] not null default '{}',
  link_cta     jsonb,
  status       text not null default 'upcoming' check (status in ('upcoming','past','cancelled'))
);
create index events_start_idx on public.events (start_at);

-- ---------- NEWS (admin-published; service-role writes only) ----------
create table public.news_articles (
  id           text primary key default ('n_' || replace(gen_random_uuid()::text, '-', '')),
  title        text not null,
  slug         text not null unique,
  excerpt      text not null default '',
  body         text not null default '',
  image        text,
  source       text not null,
  author       text,
  published_at timestamptz not null default now()
);

-- ---------- RESOURCES (civic; service-role writes only) ----------
create table public.resources (
  id          text primary key default ('r_' || replace(gen_random_uuid()::text, '-', '')),
  name        text not null,
  category    text not null check (category in ('emergency','government','community','utilities')),
  description text not null default '',
  phone       text,
  url         text,
  address     text
);

-- ---------- RECOMMENDATIONS (positive-only seam; NO value/rating column) ----------
create table public.recommendations (
  id                text primary key default gen_random_uuid()::text,
  business_id       text not null references public.businesses (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  note              text,                          -- optional comment; NOT a rating
  verified_customer boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (business_id, user_id)                    -- one per user → can't be bombed/down-voted
);
create index recommendations_business_idx on public.recommendations (business_id);
