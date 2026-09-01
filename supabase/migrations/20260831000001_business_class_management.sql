-- Owner class/workshop management.
--
-- Cancellation is deliberately a status, not a delete: owners can restore an entry and
-- keep its history. Cancelled rows are hidden at the database boundary from everyone
-- except the owner of the attached business. The consumer query also filters them, but
-- RLS is the control that prevents a direct REST request from exposing them.

alter table public.business_classes
  drop constraint if exists business_classes_status_check;

alter table public.business_classes
  add constraint business_classes_status_check
  check (status in ('open', 'sold_out', 'waitlist', 'cancelled'));

drop policy if exists business_classes_read on public.business_classes;

create policy business_classes_public_read
  on public.business_classes for select
  to anon, authenticated
  using (status <> 'cancelled');

create policy business_classes_owner_read
  on public.business_classes for select
  to authenticated
  using (public.is_business_owner(business_id));
