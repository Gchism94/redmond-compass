-- Owner content management: make scheduled bulletins reliable and protect events
-- whose source of truth is the Google Calendar sync.

-- A free bulletin consumes a slot in the month it is intended to publish. This also
-- closes the former loophole where unlimited scheduled rows could bypass the live cap.
create or replace function public.enforce_bulletin_cap()
returns trigger language plpgsql set search_path = public as $$
declare
  b_tier text;
  used int;
  cap int := 3;
  effective_at timestamptz;
begin
  if new.status not in ('live', 'scheduled') then return new; end if;
  if new.status = 'scheduled' and new.scheduled_for is null then
    raise exception 'Scheduled bulletins require a publish date';
  end if;

  if tg_op = 'UPDATE' and new.status = 'scheduled' and old.status <> 'scheduled' then
    raise exception 'Only new bulletins can be scheduled';
  end if;

  -- Keep the effective publish month authoritative even for a direct REST caller.
  -- A live insert cannot smuggle in a future date to bypass this month's cap; only the
  -- due-post publisher may transition scheduled -> live, and an archive restore becomes
  -- a new publication in the current month.
  if new.status = 'live' then
    if tg_op = 'INSERT' then
      new.scheduled_for := null;
    elsif old.status = 'scheduled' then
      if old.scheduled_for > now() then
        raise exception 'This bulletin is scheduled for a future date';
      end if;
      new.scheduled_for := old.scheduled_for;
    elsif old.status = 'expired' then
      new.scheduled_for := now();
    else
      new.scheduled_for := old.scheduled_for;
    end if;
  end if;

  -- Body/link edits do not consume a second slot or fail because of legacy rows.
  if tg_op = 'UPDATE'
     and new.status = old.status
     and new.scheduled_for is not distinct from old.scheduled_for then
    return new;
  end if;

  select tier into b_tier from public.businesses where id = new.business_id;
  if b_tier = 'free' then
    effective_at := coalesce(new.scheduled_for, new.created_at, now());
    select count(*) into used
      from public.bulletins
      where business_id = new.business_id
        and id is distinct from new.id
        -- Archiving does not refund a publish slot. Without expired rows in this count,
        -- an owner could archive and repost indefinitely inside one month.
        and status in ('live', 'scheduled', 'expired')
        and date_trunc('month', coalesce(scheduled_for, created_at)) = date_trunc('month', effective_at);
    if used >= cap then
      raise exception 'Free monthly bulletin cap reached (%) for that publish month', cap;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_bulletin_cap on public.bulletins;
create trigger trg_bulletin_cap
  before insert or update on public.bulletins
  for each row execute function public.enforce_bulletin_cap();

-- Demand-driven scheduled publishing. It is safe for a public reader to call: the
-- function is idempotent and can only promote rows whose owner-selected time has passed.
create or replace function public.publish_due_bulletins()
returns integer language plpgsql security definer set search_path = public as $$
declare promoted integer;
begin
  update public.bulletins
    set status = 'live'
    where status = 'scheduled' and scheduled_for <= now();
  get diagnostics promoted = row_count;
  return promoted;
end $$;

revoke all on function public.publish_due_bulletins() from public;
grant execute on function public.publish_due_bulletins() to anon, authenticated, service_role;

-- Owners may manage app-authored events. Calendar-synced events remain owned by the
-- inbound sync so edits are never silently overwritten and deletions never reappear.
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;

create policy events_insert on public.events for insert to authenticated
  with check (
    business_id is not null
    and gcal_event_id is null
    and public.is_business_owner(business_id)
  );

create policy events_update on public.events for update to authenticated
  using (
    business_id is not null
    and gcal_event_id is null
    and public.is_business_owner(business_id)
  )
  with check (
    business_id is not null
    and gcal_event_id is null
    and public.is_business_owner(business_id)
  );

create policy events_delete on public.events for delete to authenticated
  using (
    business_id is not null
    and gcal_event_id is null
    and public.is_business_owner(business_id)
  );
