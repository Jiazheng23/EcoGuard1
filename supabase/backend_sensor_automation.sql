-- EcoGuard backend sensor automation
-- Apply after sensor_current_metrics.sql.
-- Updates one current location_metrics row per ecological location every five minutes.
-- First enable Supabase Cron from Dashboard > Integrations > Cron.

begin;

do $$
begin
  if to_regclass('public.ecological_locations') is null
    or to_regclass('public.location_metrics') is null
    or to_regprocedure('private.evaluate_environmental_thresholds()') is null then
    raise exception 'Apply the EcoGuard location, metric, and early-warning schemas first.';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    raise exception 'Enable Supabase Cron from Dashboard > Integrations > Cron, then rerun this script.';
  end if;
end $$;

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
      next_temperature := 24 + random() * 10;

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
          current_metric.crowd_count + (random() * 2 - 1) * greatest(2, capacity_value * 0.08)
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
      next_air_quality := round(greatest(0, least(500, current_metric.air_quality_index + (random() * 24 - 12))));
      next_water_quality := greatest(0, least(100, current_metric.water_quality_score::double precision + (random() * 8 - 4)));
      next_temperature := greatest(-10, least(55, coalesce(current_metric.temperature_c::double precision, 27) + (random() * 2 - 1)));

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

comment on function private.refresh_location_sensor_metrics() is
  'Refreshes the latest environmental sensor row for every EcoGuard location.';

select cron.schedule(
  'ecoguard-sensor-refresh',
  '*/5 * * * *',
  'select private.refresh_location_sensor_metrics();'
);

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'location_metrics'
  ) then
    execute 'alter publication supabase_realtime add table public.location_metrics';
  end if;
end $$;

commit;

-- Verification after applying:
-- select private.refresh_location_sensor_metrics();
-- select jobid, jobname, schedule, active
-- from cron.job
-- where jobname = 'ecoguard-sensor-refresh';
-- select location_id, count(*) as row_count, max(recorded_at) as latest_update
-- from public.location_metrics
-- group by location_id
-- order by location_id;
