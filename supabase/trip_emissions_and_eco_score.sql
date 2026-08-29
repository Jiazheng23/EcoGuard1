-- EcoGuard trip emissions and Eco Score rules
-- Apply this complete SQL script once in the Supabase SQL Editor.

begin;

create schema if not exists private;

alter table public.trips
  add column if not exists bus_engine_class text null,
  add column if not exists car_powertrain text null;

update public.trips
set bus_engine_class = case
  when transport_mode = 'bus' then coalesce(bus_engine_class, 'over_5000cc')
  else null
end
where bus_engine_class is distinct from case
  when transport_mode = 'bus' then coalesce(bus_engine_class, 'over_5000cc')
  else null
end;

alter table public.trips
  drop constraint if exists trips_bus_engine_class_check;

alter table public.trips
  add constraint trips_bus_engine_class_check check (
    (
      transport_mode = 'bus'
      and bus_engine_class in ('under_5000cc', 'over_5000cc')
    )
    or (
      transport_mode <> 'bus'
      and bus_engine_class is null
    )
  );

comment on column public.trips.bus_engine_class is
  'Internal bus class retained for existing trips; new trips use the standard large-bus factor.';

update public.trips
set car_powertrain = case
  when transport_mode = 'car' then coalesce(car_powertrain, 'petrol')
  else null
end
where car_powertrain is distinct from case
  when transport_mode = 'car' then coalesce(car_powertrain, 'petrol')
  else null
end;

alter table public.trips
  drop constraint if exists trips_car_powertrain_check;

alter table public.trips
  add constraint trips_car_powertrain_check check (
    (
      transport_mode = 'car'
      and car_powertrain in ('petrol', 'electricity')
    )
    or (
      transport_mode <> 'car'
      and car_powertrain is null
    )
  );

comment on column public.trips.car_powertrain is
  'Car power source used for the passenger-kilometre emission factor.';

drop function if exists private.trip_emission_factor_g(text, text);

create or replace function private.trip_emission_factor_g(
  transport_mode_value text,
  bus_engine_class_value text default null,
  car_powertrain_value text default null
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(transport_mode_value))
    when 'car' then case lower(btrim(coalesce(car_powertrain_value, 'petrol')))
      when 'petrol' then 135.45::numeric
      when 'electricity' then 92.45::numeric
      else null::numeric
    end
    when 'motorcycle' then 41.57::numeric
    when 'bus' then case lower(btrim(coalesce(bus_engine_class_value, 'over_5000cc')))
      when 'under_5000cc' then 30.47::numeric
      when 'over_5000cc' then 45.45::numeric
      else null::numeric
    end
    when 'walking' then 0::numeric
    when 'bicycle' then 0::numeric
    else null::numeric
  end;
$$;

create or replace function private.recommended_trip_mode(distance_km_value numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when distance_km_value <= 2 then 'walking'
    when distance_km_value <= 10 then 'bicycle'
    else 'bus'
  end;
$$;

create or replace function private.trip_eco_score_change(
  transport_mode_value text,
  distance_km_value numeric,
  carbon_emission_kg_value numeric
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(-10, least(10,
    case transport_mode_value
      when 'walking' then case when distance_km_value <= 2 then 5 else 2 end
      when 'bicycle' then case when distance_km_value <= 10 then 5 else 2 end
      when 'bus' then case when distance_km_value <= 10 then 3 else 1 end
      when 'motorcycle' then case when distance_km_value <= 10 then 1 else 0 end
      when 'car' then case when distance_km_value <= 10 then -4 else -6 end
      else 0
    end
    + case
        when carbon_emission_kg_value <= 1 then 2
        when carbon_emission_kg_value <= 5 then 0
        when carbon_emission_kg_value <= 15 then -3
        else -6
      end
    + case
        when transport_mode_value = private.recommended_trip_mode(distance_km_value) then 3
        else 0
      end
  ))::integer;
$$;

create or replace function private.prepare_trip_environmental_values()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  emission_factor_g numeric;
  effective_distance_km numeric;
begin
  new.transport_mode := lower(btrim(new.transport_mode));

  if new.transport_mode not in ('car', 'motorcycle', 'bus', 'walking', 'bicycle') then
    raise check_violation using message = 'Unsupported transport mode.';
  end if;

  if new.transport_mode = 'bus' then
    new.bus_engine_class := lower(btrim(coalesce(new.bus_engine_class, 'over_5000cc')));
  else
    new.bus_engine_class := null;
  end if;

  if new.transport_mode = 'car' then
    new.car_powertrain := lower(btrim(coalesce(new.car_powertrain, 'petrol')));
  else
    new.car_powertrain := null;
  end if;

  emission_factor_g := private.trip_emission_factor_g(
    new.transport_mode,
    new.bus_engine_class,
    new.car_powertrain
  );

  if emission_factor_g is null then
    raise check_violation using message = 'Unsupported transport configuration.';
  end if;

  effective_distance_km := new.distance_km * case when new.round_trip then 2 else 1 end;
  new.carbon_emission := round((effective_distance_km * emission_factor_g) / 1000, 2);
  new.total_emission := round(new.carbon_emission * new.passengers, 2);
  new.eco_points := private.trip_eco_score_change(
    new.transport_mode,
    new.distance_km,
    new.carbon_emission
  );

  return new;
end;
$$;

drop trigger if exists calculate_trip_environmental_values on public.trips;

create trigger calculate_trip_environmental_values
before insert or update of transport_mode, bus_engine_class, car_powertrain, distance_km, passengers, round_trip,
  carbon_emission, total_emission, eco_points
on public.trips
for each row
execute function private.prepare_trip_environmental_values();

drop trigger if exists sync_profile_on_trip_insert on public.trips;
drop function if exists public.sync_profile_after_trip_insert();

create or replace function private.sync_profile_after_trip_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  car_baseline_total numeric;
  saved_amount numeric;
begin
  car_baseline_total := round(
    new.distance_km
      * case when new.round_trip then 2 else 1 end
      * 0.13545
      * new.passengers,
    2
  );
  saved_amount := greatest(0, car_baseline_total - new.total_emission);

  update public.profiles
  set eco_score = least(100, greatest(0, eco_score + new.eco_points)),
      total_carbon_saved = total_carbon_saved + saved_amount,
      updated_at = now()
  where id = new.tourist_id;

  if not found then
    raise foreign_key_violation using message = 'A profile is required before saving a trip.';
  end if;

  return new;
end;
$$;

create trigger sync_profile_on_trip_insert
after insert on public.trips
for each row
execute function private.sync_profile_after_trip_insert();

revoke all on function private.trip_emission_factor_g(text, text, text)
  from public, anon, authenticated;
revoke all on function private.recommended_trip_mode(numeric)
  from public, anon, authenticated;
revoke all on function private.trip_eco_score_change(text, numeric, numeric)
  from public, anon, authenticated;
revoke all on function private.prepare_trip_environmental_values()
  from public, anon, authenticated;
revoke all on function private.sync_profile_after_trip_insert()
  from public, anon, authenticated;

comment on function private.trip_emission_factor_g(text, text, text) is
  'Returns EcoGuard transport emissions in g CO2e per passenger-km, including car power source.';
comment on function private.trip_eco_score_change(text, numeric, numeric) is
  'Returns the signed Eco Score change for a trip, capped between -10 and +10.';
comment on function private.prepare_trip_environmental_values() is
  'Calculates trusted trip emissions and Eco Score changes before the row is saved.';
comment on function private.sync_profile_after_trip_insert() is
  'Applies the trusted trip Eco Score change and carbon saving to the tourist profile.';

commit;

-- Verification after applying:
-- select transport_mode, car_powertrain, distance_km, carbon_emission,
--        total_emission, eco_points
-- from public.trips
-- order by travelled_at desc
-- limit 10;
