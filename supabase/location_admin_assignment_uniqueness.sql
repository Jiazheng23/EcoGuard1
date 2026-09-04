-- Apply this script to projects that already ran admin_location_scope.sql.
-- Prevent conflicting location-admin assignments and reservations.

do $$
begin
  if exists (
    select 1
    from public.profiles
    where role = 'location_admin' and location_id is not null
    group by location_id
    having count(*) > 1
  ) then
    raise exception 'Resolve duplicate approved location-admin assignments before applying this constraint.';
  end if;

  if exists (
    select 1
    from public.location_admin_applications
    where status = 'pending' and requested_location_id is not null
    group by requested_location_id
    having count(*) > 1
  ) then
    raise exception 'Resolve duplicate pending location-admin applications before applying this constraint.';
  end if;
end $$;

create unique index if not exists profiles_one_location_admin_per_location_idx
  on public.profiles(location_id)
  where role = 'location_admin';

create unique index if not exists location_admin_applications_one_pending_location_idx
  on public.location_admin_applications(requested_location_id)
  where status = 'pending' and requested_location_id is not null;

-- Verification: both queries must return zero rows.
select location_id, count(*)
from public.profiles
where role = 'location_admin' and location_id is not null
group by location_id
having count(*) > 1;

select requested_location_id, count(*)
from public.location_admin_applications
where status = 'pending' and requested_location_id is not null
group by requested_location_id
having count(*) > 1;
