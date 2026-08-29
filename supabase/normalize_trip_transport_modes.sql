-- Run this once in the Supabase Dashboard SQL Editor.
-- It keeps recorded distances, emissions, points, and other trip details unchanged.

-- Preview the values and row counts that currently exist.
select
  coalesce(transport_mode, '<null>') as current_transport_mode,
  count(*) as trip_count
from public.trips
group by transport_mode
order by trip_count desc, current_transport_mode;

begin;

set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- Normalize aliases and convert retired transport modes to the closest
-- currently supported category. Unknown legacy values fall back to Car.
update public.trips
set transport_mode = case lower(btrim(coalesce(transport_mode, '')))
  when 'car' then 'car'
  when 'automobile' then 'car'
  when 'flight' then 'car'
  when 'plane' then 'car'
  when 'airplane' then 'car'

  when 'motorcycle' then 'motorcycle'
  when 'motorbike' then 'motorcycle'
  when 'motor cycle' then 'motorcycle'

  when 'bus' then 'bus'
  when 'mrt' then 'bus'
  when 'lrt' then 'bus'
  when 'mrt/lrt' then 'bus'
  when 'mrt / lrt' then 'bus'
  when 'train' then 'bus'
  when 'ets' then 'bus'
  when 'ets train' then 'bus'
  when 'public transport' then 'bus'
  when 'public_transport' then 'bus'

  when 'walking' then 'walking'
  when 'walk' then 'walking'
  when 'on foot' then 'walking'

  when 'bicycle' then 'bicycle'
  when 'bike' then 'bicycle'
  when 'cycling' then 'bicycle'
  when 'cycle' then 'bicycle'

  else 'car'
end
where transport_mode is distinct from case lower(btrim(coalesce(transport_mode, '')))
  when 'car' then 'car'
  when 'automobile' then 'car'
  when 'flight' then 'car'
  when 'plane' then 'car'
  when 'airplane' then 'car'
  when 'motorcycle' then 'motorcycle'
  when 'motorbike' then 'motorcycle'
  when 'motor cycle' then 'motorcycle'
  when 'bus' then 'bus'
  when 'mrt' then 'bus'
  when 'lrt' then 'bus'
  when 'mrt/lrt' then 'bus'
  when 'mrt / lrt' then 'bus'
  when 'train' then 'bus'
  when 'ets' then 'bus'
  when 'ets train' then 'bus'
  when 'public transport' then 'bus'
  when 'public_transport' then 'bus'
  when 'walking' then 'walking'
  when 'walk' then 'walking'
  when 'on foot' then 'walking'
  when 'bicycle' then 'bicycle'
  when 'bike' then 'bicycle'
  when 'cycling' then 'bicycle'
  when 'cycle' then 'bicycle'
  else 'car'
end;

-- Enforce the five supported values for future writes.
alter table public.trips
  drop constraint if exists trips_supported_transport_mode_check;

alter table public.trips
  add constraint trips_supported_transport_mode_check
  check (
    transport_mode is not null
    and transport_mode in ('car', 'motorcycle', 'bus', 'walking', 'bicycle')
  ) not valid;

alter table public.trips
  validate constraint trips_supported_transport_mode_check;

commit;

-- Verification: this should return exactly the five supported modes (or fewer
-- when a mode has no trips), and unsupported_trip_count should be zero.
select transport_mode, count(*) as trip_count
from public.trips
group by transport_mode
order by transport_mode;

select count(*) as unsupported_trip_count
from public.trips
where transport_mode is null
   or transport_mode not in ('car', 'motorcycle', 'bus', 'walking', 'bicycle');
