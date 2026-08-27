-- Seed and expose simulated ecological monitoring data for every location.
-- Apply after admin_location_scope.sql and waste_management.sql.

begin;

create or replace function public.seed_ecological_location_monitoring()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  initial_waste numeric(12, 2);
begin
  -- Conservative initial values keep a new destination useful without making
  -- an unsupported claim that conditions are dangerous.
  initial_waste := round((greatest(new.max_capacity, 1) * (0.012 + random() * 0.006))::numeric, 2);

  insert into public.crowd_thresholds (
    location_id,
    caution_percent,
    warning_percent,
    critical_percent,
    auto_alerts,
    updated_by
  ) values (
    new.id, 60, 80, 90, true, auth.uid()
  ) on conflict (location_id) do nothing;

  insert into public.waste_thresholds (
    location_id,
    moderate_kg,
    high_risk_kg,
    critical_kg,
    updated_by
  ) values (
    new.id,
    round((greatest(new.max_capacity, 1) * 0.025)::numeric, 2),
    round((greatest(new.max_capacity, 1) * 0.050)::numeric, 2),
    round((greatest(new.max_capacity, 1) * 0.075)::numeric, 2),
    auth.uid()
  ) on conflict (location_id) do nothing;

  insert into public.location_metrics (
    location_id,
    crowd_count,
    waste_kg,
    recycled_kg,
    air_quality_index,
    water_quality_score,
    temperature_c,
    source
  ) values (
    new.id,
    round(greatest(new.max_capacity, 1) * (0.25 + random() * 0.20))::integer,
    initial_waste,
    round((initial_waste * (0.35 + random() * 0.25))::numeric, 2),
    round(35 + random() * 30)::integer,
    round((78 + random() * 14)::numeric, 1),
    round((25 + random() * 6)::numeric, 1),
    'simulated'
  );

  return new;
end;
$$;

revoke all on function public.seed_ecological_location_monitoring() from public;

drop trigger if exists seed_ecological_location_monitoring_after_insert
  on public.ecological_locations;
create trigger seed_ecological_location_monitoring_after_insert
after insert on public.ecological_locations
for each row execute function public.seed_ecological_location_monitoring();

-- Backfill existing destinations that have no stored monitoring snapshot.
insert into public.location_metrics (
  location_id,
  crowd_count,
  waste_kg,
  recycled_kg,
  air_quality_index,
  water_quality_score,
  temperature_c,
  source
)
select
  location.id,
  round(greatest(location.max_capacity, 1) * 0.35)::integer,
  round((greatest(location.max_capacity, 1) * 0.018)::numeric, 2),
  round((greatest(location.max_capacity, 1) * 0.009)::numeric, 2),
  48,
  86,
  27,
  'simulated'
from public.ecological_locations location
where not exists (
  select 1 from public.location_metrics metric where metric.location_id = location.id
);

insert into public.crowd_thresholds (
  location_id, caution_percent, warning_percent, critical_percent, auto_alerts, updated_by
)
select location.id, 60, 80, 90, true, location.created_by
from public.ecological_locations location
where location.created_by is not null
on conflict (location_id) do nothing;

insert into public.waste_thresholds (
  location_id, moderate_kg, high_risk_kg, critical_kg, updated_by
)
select
  location.id,
  round((greatest(location.max_capacity, 1) * 0.025)::numeric, 2),
  round((greatest(location.max_capacity, 1) * 0.050)::numeric, 2),
  round((greatest(location.max_capacity, 1) * 0.075)::numeric, 2),
  location.created_by
from public.ecological_locations location
where location.created_by is not null
on conflict (location_id) do nothing;

-- Add the aggregate visitor estimate to the tourist-safe function result.
drop function if exists public.get_tourist_environmental_indicators();
create function public.get_tourist_environmental_indicators()
returns table (
  location_id bigint,
  crowd_level text,
  warning_level text,
  environment_condition text,
  waste_level text,
  visitor_count integer,
  recycling_rate numeric,
  recorded_at timestamptz,
  data_source text
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest_metric as (
    select distinct on (metric.location_id) metric.*
    from public.location_metrics metric
    order by metric.location_id, metric.recorded_at desc
  ), scored as (
    select location.id as location_id,
      metric.crowd_count, metric.waste_kg, metric.recycled_kg,
      metric.air_quality_index, metric.water_quality_score,
      metric.recorded_at, metric.source,
      100.0 * coalesce(metric.crowd_count, 0) / greatest(location.max_capacity, 1) as occupancy_percent,
      coalesce(crowd.caution_percent, 60) as caution_percent,
      coalesce(crowd.warning_percent, 80) as warning_percent,
      coalesce(crowd.critical_percent, 90) as critical_percent,
      waste.moderate_kg, waste.high_risk_kg, waste.critical_kg
    from public.ecological_locations location
    left join latest_metric metric on metric.location_id = location.id
    left join public.crowd_thresholds crowd on crowd.location_id = location.id
    left join public.waste_thresholds waste on waste.location_id = location.id
    where location.is_active
  )
  select scored.location_id,
    case when scored.recorded_at is null then 'Awaiting data'
      when scored.occupancy_percent >= scored.critical_percent then 'Critical'
      when scored.occupancy_percent >= scored.warning_percent then 'High'
      when scored.occupancy_percent >= scored.caution_percent then 'Moderate' else 'Low' end,
    case when scored.recorded_at is null then 'Awaiting data'
      when scored.occupancy_percent >= scored.critical_percent then 'Critical'
      when scored.occupancy_percent >= scored.warning_percent then 'High Risk'
      when scored.occupancy_percent >= scored.caution_percent then 'Caution' else 'Safe' end,
    case when scored.recorded_at is null then 'Awaiting data'
      when scored.air_quality_index <= 50 and scored.water_quality_score >= 80 then 'Excellent'
      when scored.air_quality_index <= 100 and scored.water_quality_score >= 65 then 'Good'
      when scored.air_quality_index <= 150 and scored.water_quality_score >= 50 then 'Fair' else 'Poor' end,
    case when scored.recorded_at is null then 'Awaiting data'
      when scored.moderate_kg is null then 'Not configured'
      when scored.waste_kg >= scored.critical_kg then 'Critical'
      when scored.waste_kg >= scored.high_risk_kg then 'High Risk'
      when scored.waste_kg >= scored.moderate_kg then 'Moderate' else 'Normal' end,
    scored.crowd_count,
    case when scored.recorded_at is null or scored.waste_kg <= 0 then null
      else round((100.0 * scored.recycled_kg / scored.waste_kg)::numeric, 1) end,
    scored.recorded_at,
    case when scored.recorded_at is null then 'unavailable'
      when scored.source = 'simulated' then 'simulated' else 'stored_estimate' end
  from scored order by scored.location_id;
$$;

comment on function public.get_tourist_environmental_indicators() is
  'Tourist-safe aggregate environmental statuses and visitor estimate; no operational records or notes.';
revoke all on function public.get_tourist_environmental_indicators() from public;
grant execute on function public.get_tourist_environmental_indicators() to authenticated;

commit;
