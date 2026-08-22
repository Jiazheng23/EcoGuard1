-- EcoGuard Waste Management demonstration data
-- Apply only after admin_location_scope.sql and waste_management.sql.
-- This script is idempotent by its [EcoGuard demo] notes and does not delete data.

begin;

do $$
begin
  if to_regclass('public.waste_collection_records') is null then
    raise exception 'Apply supabase/waste_management.sql before waste_demo_data.sql.';
  end if;

  if not exists (
    select 1 from public.profiles
    where role in ('super_admin', 'location_admin')
  ) then
    raise exception 'Create an approved super_admin or location_admin profile before loading demonstration data.';
  end if;

  if not exists (select 1 from public.ecological_locations where is_active) then
    raise exception 'Create at least one active ecological location before loading demonstration data.';
  end if;
end $$;

with demo_admin as (
  select id
  from public.profiles
  where role in ('super_admin', 'location_admin')
  order by case role when 'super_admin' then 0 else 1 end, created_at
  limit 1
), demo_locations as (
  select id
  from public.ecological_locations
  where is_active
  order by id
  limit 3
)
insert into public.waste_thresholds (
  location_id,
  moderate_kg,
  high_risk_kg,
  critical_kg,
  updated_by
)
select location.id, 25, 50, 75, administrator.id
from demo_locations location
cross join demo_admin administrator
on conflict (location_id) do nothing;

with demo_admin as (
  select id
  from public.profiles
  where role in ('super_admin', 'location_admin')
  order by case role when 'super_admin' then 0 else 1 end, created_at
  limit 1
), demo_locations as (
  select id
  from public.ecological_locations
  where is_active
  order by id
  limit 3
), demo_rows as (
  select
    location.id as location_id,
    week_number,
    18 + (location.id % 7) + week_number * 3 as total_kg,
    format('[EcoGuard demo] historical collection L%s-W%s', location.id, week_number) as demo_note
  from demo_locations location
  cross join generate_series(1, 8) as week_number
)
insert into public.waste_collection_records (
  location_id,
  collected_at,
  total_kg,
  recycled_kg,
  waste_type,
  status,
  source,
  notes,
  recorded_by
)
select
  demo.location_id,
  now() - make_interval(days => demo.week_number * 7),
  demo.total_kg,
  round(demo.total_kg * (0.30 + (demo.week_number % 4) * 0.08), 2),
  (array['mixed', 'recyclable', 'organic', 'hazardous'])[1 + ((demo.week_number - 1) % 4)],
  case when demo.week_number % 5 = 0 then 'partial' else 'completed' end,
  case when demo.week_number % 2 = 0 then 'simulated_sensor' else 'manual' end,
  demo.demo_note,
  administrator.id
from demo_rows demo
cross join demo_admin administrator
where not exists (
  select 1
  from public.waste_collection_records existing
  where existing.notes = demo.demo_note
);

with demo_admin as (
  select id
  from public.profiles
  where role in ('super_admin', 'location_admin')
  order by case role when 'super_admin' then 0 else 1 end, created_at
  limit 1
), demo_locations as (
  select id, row_number() over (order by id) as sequence_number
  from public.ecological_locations
  where is_active
  order by id
  limit 3
), proposed as (
  select
    location.id as location_id,
    now() + interval '14 days' + location.sequence_number * interval '3 hours' as scheduled_for,
    now() + interval '14 days' + location.sequence_number * interval '3 hours' + interval '90 minutes' as scheduled_until,
    format('[EcoGuard demo] upcoming collection L%s', location.id) as demo_note
  from demo_locations location
)
insert into public.waste_collection_schedules (
  location_id,
  scheduled_for,
  scheduled_until,
  waste_type,
  assigned_team,
  status,
  notes,
  created_by,
  updated_by
)
select
  proposed.location_id,
  proposed.scheduled_for,
  proposed.scheduled_until,
  'mixed',
  'EcoGuard Demo Team',
  'scheduled',
  proposed.demo_note,
  administrator.id,
  administrator.id
from proposed
cross join demo_admin administrator
where not exists (
  select 1
  from public.waste_collection_schedules existing
  where existing.notes = proposed.demo_note
)
and not exists (
  select 1
  from public.waste_collection_schedules existing
  where existing.location_id = proposed.location_id
    and existing.status = 'scheduled'
    and tstzrange(existing.scheduled_for, existing.scheduled_until, '[)')
      && tstzrange(proposed.scheduled_for, proposed.scheduled_until, '[)')
);

with demo_locations as (
  select id, max_capacity
  from public.ecological_locations
  where is_active
  order by id
  limit 3
)
insert into public.location_metrics (
  location_id,
  crowd_count,
  waste_kg,
  recycled_kg,
  air_quality_index,
  water_quality_score,
  temperature_c,
  source,
  recorded_at
)
select
  location.id,
  round(location.max_capacity * 0.45)::integer,
  42,
  17,
  48,
  86,
  27,
  'simulated',
  now()
from demo_locations location
where not exists (
  select 1
  from public.location_metrics existing
  where existing.location_id = location.id
    and existing.source = 'simulated'
    and existing.recorded_at > now() - interval '1 day'
);

commit;

-- Expected per seeded location:
--   8 historical collection records (manual and clearly labelled simulated)
--   1 threshold configuration
--   1 non-conflicting upcoming schedule when a slot is available
--   1 recent simulated environmental snapshot when none exists today
