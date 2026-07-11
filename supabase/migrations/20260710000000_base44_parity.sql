-- ============================================================================
-- Base44 → own-platform parity (Stage 1 migration, GAP-REPORT §3c dispositions).
-- Absorbs the schema deltas so the one-time Base44 import lands losslessly:
--   • businesses: free-parity fields the live site already shows (long description,
--     socials, message link, specials, extra locations/categories, free-text hours).
--     NO featured/boost column — equal ranking stays structural.
--   • events: submission workflow (approval_status, submitter) + Google Calendar
--     sync key (gcal_event_id). Public read narrows to APPROVED rows.
--   • news_articles: category / pinned / source_url (pinned = editorial content
--     ordering on News, never business ranking).
--   • resources: category constraint widened 4 → 10 (live data uses 8) + richer fields.
--   • 4 new tables for Base44 entities with no equivalent: community_bulletins,
--     community_videos, business_classes, yard_sales. All RLS'd; still NO
--     rating/score column and NO paid-placement column anywhere.
-- ============================================================================

-- ---------- BUSINESSES: free-tier parity fields ----------
alter table public.businesses
  add column long_description     text,
  add column message_link         text,
  add column socials              jsonb,   -- { facebook, instagram, tiktok, youtube, linkedin, twitter, pinterest }
  add column license_number       text,
  add column specials             text,
  add column specials_image_url   text,
  add column additional_locations jsonb,   -- up to 5 extra locations (name/address/hours)
  add column extra_categories     text[] not null default '{}',  -- multi-category memberships beyond `category`
  add column hours_text           text;    -- unstructured hours (Base44 stored free text); structured `hours` stays canonical

-- ---------- EVENTS: submissions + calendar sync ----------
alter table public.events
  add column approval_status text not null default 'approved'
    check (approval_status in ('pending','approved')),
  add column submitter_name  text,
  add column submitter_email text,   -- populated by the future submit flow only; the import leaves it null (privacy)
  add column gcal_event_id   text unique;  -- dedupe key for the Google Calendar inbound sync

-- Public read narrows to approved events; a business owner still sees their own pending.
drop policy events_read on public.events;
create policy events_read on public.events for select
  using (approval_status = 'approved'
         or (business_id is not null and public.is_business_owner(business_id)));

-- ---------- NEWS: category / pinned / source link ----------
alter table public.news_articles
  add column category   text,
  add column pinned     boolean not null default false,
  add column source_url text;

-- ---------- RESOURCES: widen categories (live data uses 8) + parity fields ----------
alter table public.resources drop constraint resources_category_check;
alter table public.resources add constraint resources_category_check
  check (category in ('emergency','government','community','utilities',
                      'health','mental_health','education','housing','transportation','other'));
alter table public.resources
  add column subcategory       text,
  add column image_url         text,
  add column email             text,
  add column additional_phones jsonb,  -- [{ label, phone }]
  add column service_times     text,
  add column facebook          text,
  add column instagram         text;

-- ---------- NEW TABLES (Base44 entities with no prior equivalent) ----------

-- Community bulletin board (loss/support/celebration announcements — not business posts).
create table public.community_bulletins (
  id            text primary key default ('cb_' || replace(gen_random_uuid()::text, '-', '')),
  title         text not null,
  body          text not null,
  image_url     text,
  support_link  text,            -- GoFundMe etc.
  support_label text,
  pinned        boolean not null default false,  -- editorial pin (content), not ranking
  category      text check (category in ('loss','support','celebration','announcement','other')),
  created_at    timestamptz not null default now()
);

-- Community videos (YouTube embeds on the Community page).
create table public.community_videos (
  id          text primary key default ('cv_' || replace(gen_random_uuid()::text, '-', '')),
  title       text not null,
  description text,
  youtube_url text not null,
  category    text,
  source_name text,
  is_default  boolean not null default false,  -- which video loads first (editorial default, not paid placement)
  created_at  timestamptz not null default now()
);

-- Classes/workshops offered by businesses (distinct from one-off events).
create table public.business_classes (
  id          text primary key default ('bc_' || replace(gen_random_uuid()::text, '-', '')),
  business_id text not null references public.businesses (id) on delete cascade,
  title       text not null,
  date        date not null,
  time_text   text,
  location    text,
  description text,
  link        text,
  image_url   text,
  status      text not null default 'open' check (status in ('open','sold_out','waitlist')),
  created_at  timestamptz not null default now()
);
create index business_classes_business_idx on public.business_classes (business_id);

-- Yard/estate/pop-up sales (public submit-and-browse; submit flow ships in Phase 2).
create table public.yard_sales (
  id            text primary key default ('ys_' || replace(gen_random_uuid()::text, '-', '')),
  title         text not null,
  category      text not null check (category in ('yard-garage','estate','pop-up','other')),
  location      text,
  start_date    date not null,
  end_date      date,
  start_time    text,
  end_time      text,
  description   text,
  image_url     text,
  contact_email text,  -- admin contact only; Phase 2 submit flow must not render it publicly
  status        text not null default 'pending' check (status in ('pending','approved','archived')),
  created_at    timestamptz not null default now()
);

-- ---------- grants (blanket grants covered only tables existing at grant time) ----------
grant select on public.community_bulletins, public.community_videos,
                public.business_classes, public.yard_sales to anon, authenticated;
grant insert, update, delete on public.business_classes to authenticated;
grant all privileges on public.community_bulletins, public.community_videos,
                        public.business_classes, public.yard_sales to service_role;

-- ---------- RLS ----------
alter table public.community_bulletins enable row level security;
alter table public.community_videos    enable row level security;
alter table public.business_classes    enable row level security;
alter table public.yard_sales          enable row level security;

create policy community_bulletins_read on public.community_bulletins for select using (true);
create policy community_videos_read    on public.community_videos    for select using (true);
-- classes: public read; writes by the owning business (same pattern as bulletins/events)
create policy business_classes_read   on public.business_classes for select using (true);
create policy business_classes_insert on public.business_classes for insert to authenticated
  with check (public.is_business_owner(business_id));
create policy business_classes_update on public.business_classes for update to authenticated
  using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));
create policy business_classes_delete on public.business_classes for delete to authenticated
  using (public.is_business_owner(business_id));
-- yard sales: public sees approved only; writes via service_role until the Phase 2 submit flow
create policy yard_sales_read on public.yard_sales for select using (status = 'approved');
