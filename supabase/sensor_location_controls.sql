-- EcoGuard per-location backend sensor controls
-- Apply after backend_sensor_automation.sql.

begin;

create table if not exists public.location_sensor_controls (
  location_id bigint primary key
    references public.ecological_locations(id) on delete cascade,
  is_enabled boolean not null default true,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null
);

comment on table public.location_sensor_controls is
  'Controls whether the five-minute backend sensor job updates each location.';

create index if not exists location_sensor_controls_updated_by_idx
  on public.location_sensor_controls (updated_by)
  where updated_by is not null;

insert into public.location_sensor_controls (location_id, is_enabled)
select location.id, true
from public.ecological_locations as location
on conflict (location_id) do nothing;

revoke all on table public.location_sensor_controls from anon, authenticated;
grant select, insert, update on table public.location_sensor_controls to authenticated;
alter table public.location_sensor_controls enable row level security;

drop policy if exists sensor_controls_admin_read on public.location_sensor_controls;
create policy sensor_controls_admin_read on public.location_sensor_controls
for select to authenticated
using (
  (select public.current_app_role()) = 'super_admin'
  or (
    (select public.current_app_role()) = 'location_admin'
    and location_id = (select public.current_location_id())
  )
);

drop policy if exists sensor_controls_admin_insert on public.location_sensor_controls;
create policy sensor_controls_admin_insert on public.location_sensor_controls
for insert to authenticated
with check (
  updated_by = (select auth.uid())
  and (
    (select public.current_app_role()) = 'super_admin'
    or (
      (select public.current_app_role()) = 'location_admin'
      and location_id = (select public.current_location_id())
    )
  )
);

drop policy if exists sensor_controls_admin_update on public.location_sensor_controls;
create policy sensor_controls_admin_update on public.location_sensor_controls
for update to authenticated
using (
  (select public.current_app_role()) = 'super_admin'
  or (
    (select public.current_app_role()) = 'location_admin'
    and location_id = (select public.current_location_id())
  )
)
with check (
  updated_by = (select auth.uid())
  and (
    (select public.current_app_role()) = 'super_admin'
    or (
      (select public.current_app_role()) = 'location_admin'
      and location_id = (select public.current_location_id())
    )
  )
);

create or replace function private.refresh_location_sensor_metrics()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  location_record record;
  current_metric public.location_metrics%rowtype;
  capacity_value integer;
  next_crowd integer;
  next_waste double precision;
  next_recycled double precision;
  next_air_quality integer;
  next_water_quality double precision;
  next_temperature double precision;
  refreshed_count integer := 0;
begin
  for location_record in
    select location.id, location.max_capacity
    from public.ecological_locations as location
    left join public.location_sensor_controls as control
      on control.location_id = location.id
    where coalesce(control.is_enabled, true)
    order by location.id
  loop
    capacity_value := greatest(1, coalesce(location_record.max_capacity, 1));

    select metric.*
    into current_metric
    from public.location_metrics as metric
    where metric.location_id = location_record.id
    order by metric.recorded_at desc, metric.id desc
    limit 1
    for update;

    if current_metric.id is null then
      next_crowd := round(capacity_value * (0.25 + random() * 0.65));
      next_waste := capacity_value * (0.01 + random() * 0.035);
      next_recycled := next_waste * (0.25 + random() * 0.55);
      next_air_quality := round(30 + random() * 90);
      next_water_quality := 65 + random() * 33;
      -- Keep simulated Malaysian outdoor temperatures in a realistic range.
      next_temperature := 25 + random() * 8;

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
      ) values (
        location_record.id,
        next_crowd,
        round(next_waste::numeric, 2),
        round(next_recycled::numeric, 2),
        next_air_quality,
        round(next_water_quality::numeric, 1),
        round(next_temperature::numeric, 1),
        'sensor',
        now()
      );
    else
      next_crowd := round(greatest(
        0,
        least(
          capacity_value,
          current_metric.crowd_count + (random() * 2 - 1) * greatest(2, capacity_value * 0.012)
        )
      ));
      next_waste := greatest(
        0,
        least(
          capacity_value * 0.08,
          current_metric.waste_kg::double precision + (random() * 2 - 1) * greatest(0.35, capacity_value * 0.001)
        )
      );
      next_recycled := greatest(
        0,
        least(
          next_waste,
          current_metric.recycled_kg::double precision + (random() * 2 - 1) * greatest(0.22, capacity_value * 0.0007)
        )
      );
      next_air_quality := round(greatest(25, least(180,
        current_metric.air_quality_index * 0.75 + 65 * 0.25 + (random() * 16 - 8)
      )));
      next_water_quality := greatest(55, least(98,
        current_metric.water_quality_score::double precision * 0.75 + 82 * 0.25 + (random() * 4 - 2)
      ));
      -- Use mean reversion instead of an unbounded random walk. The hard bounds
      -- also bring any existing exaggerated value (for example 47.8 C) back
      -- into range on the next five-minute refresh.
      next_temperature := greatest(23, least(36,
        coalesce(current_metric.temperature_c::double precision, 29) * 0.65
        + 29 * 0.35
        + (random() * 1.2 - 0.6)
      ));

      update public.location_metrics
      set crowd_count = next_crowd,
          waste_kg = round(next_waste::numeric, 2),
          recycled_kg = round(next_recycled::numeric, 2),
          air_quality_index = next_air_quality,
          water_quality_score = round(next_water_quality::numeric, 1),
          temperature_c = round(next_temperature::numeric, 1),
          source = 'sensor',
          recorded_at = now()
      where id = current_metric.id;
    end if;

    refreshed_count := refreshed_count + 1;
  end loop;

  return refreshed_count;
end;
$$;

revoke all on function private.refresh_location_sensor_metrics()
  from public, anon, authenticated;
grant execute on function private.refresh_location_sensor_metrics()
  to postgres;

-- Correct previously generated outliers immediately when this script is applied.
update public.location_metrics
set temperature_c = greatest(23, least(36, temperature_c)),
    air_quality_index = greatest(25, least(180, air_quality_index)),
    water_quality_score = greatest(55, least(98, water_quality_score)),
    recorded_at = now()
where (temperature_c is not null and (temperature_c < 23 or temperature_c > 36))
   or air_quality_index < 25 or air_quality_index > 180
   or water_quality_score < 55 or water_quality_score > 98;

-- Remove impossible simulated spikes from charts while leaving manual/real
-- observations untouched. This block is safe when history is not installed.
do $$
begin
  if to_regclass('public.environmental_metric_history') is not null then
    update public.environmental_metric_history
    set temperature_c = greatest(23, least(36, temperature_c)),
        air_quality_index = greatest(25, least(180, air_quality_index)),
        water_quality_score = greatest(55, least(98, water_quality_score))
    where source in ('sensor', 'simulated', 'simulated_backfill')
      and (
        (temperature_c is not null and (temperature_c < 23 or temperature_c > 36))
        or air_quality_index < 25 or air_quality_index > 180
        or water_quality_score < 55 or water_quality_score > 98
      );
  end if;
end $$;

commit;

-- Verification:
-- update one control to is_enabled = false inside a transaction, call
-- private.refresh_location_sensor_metrics(), and confirm that location's
-- recorded_at value does not change while enabled locations do change.
-- Also confirm that exactly one scheduled job is active:
-- select jobid, jobname, schedule, active from cron.job
-- where jobname = 'ecoguard-sensor-refresh';
