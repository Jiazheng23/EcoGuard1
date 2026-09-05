-- Enable saving LRT/MRT and mixed public-transport trips.
-- Apply after trip_emissions_and_eco_score.sql.

begin;

alter table public.trips
  add column if not exists route_legs jsonb not null default '[]'::jsonb;

alter table public.trips
  drop constraint if exists trips_supported_transport_mode_check;

alter table public.trips
  add constraint trips_supported_transport_mode_check check (
    transport_mode in ('car', 'motorcycle', 'bus', 'mrt', 'mixed', 'walking', 'bicycle')
  );

-- Keep this migration self-contained. Older deployed versions of this
-- function do not know about MRT and otherwise return NULL for that mode.
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
    when 'mrt' then 70::numeric
    when 'walking' then 0::numeric
    when 'bicycle' then 0::numeric
    else null::numeric
  end;
$$;

-- Match the frontend Eco Score rules so the calculated preview, saved trip,
-- popup message, history, and profile balance all use the same score.
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
    case lower(btrim(transport_mode_value))
      when 'walking' then case when distance_km_value <= 2 then 5 else 2 end
      when 'bicycle' then case when distance_km_value <= 10 then 5 else 2 end
      when 'bus' then case when distance_km_value <= 10 then 3 else 1 end
      when 'mrt' then case when distance_km_value <= 10 then 3 else 1 end
      when 'mixed' then case when distance_km_value <= 10 then 3 else 1 end
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
        when lower(btrim(transport_mode_value)) = private.recommended_trip_mode(distance_km_value) then 3
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
  mixed_emission_g numeric := 0;
  leg jsonb;
  leg_label text;
  leg_distance_km numeric;
  leg_factor_g numeric;
begin
  new.transport_mode := lower(btrim(new.transport_mode));

  if new.transport_mode not in ('car', 'motorcycle', 'bus', 'mrt', 'mixed', 'walking', 'bicycle') then
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

  effective_distance_km := new.distance_km * case when new.round_trip then 2 else 1 end;

  if new.transport_mode = 'mixed' then
    if jsonb_typeof(new.route_legs) <> 'array' or jsonb_array_length(new.route_legs) = 0 then
      raise check_violation using message = 'Mixed trips require route legs.';
    end if;

    for leg in select value from jsonb_array_elements(new.route_legs)
    loop
      leg_label := lower(coalesce(leg->>'transportLabel', leg->>'mode', ''));
      leg_distance_km := greatest(0, coalesce((leg->>'distanceKm')::numeric, 0));
      leg_factor_g := case
        when leg_label like '%car%' then 135.45
        when leg_label like '%bus%' or leg_label like '%coach%' then 45.45
        when leg_label ~ '(lrt|mrt|rail|subway|tram|metro|monorail)' then 70
        else 0
      end;
      mixed_emission_g := mixed_emission_g + leg_distance_km * leg_factor_g;
    end loop;

    new.carbon_emission := round(
      (mixed_emission_g * case when new.round_trip then 2 else 1 end) / 1000,
      2
    );
  else
    new.route_legs := '[]'::jsonb;
    emission_factor_g := private.trip_emission_factor_g(
      new.transport_mode,
      new.bus_engine_class,
      new.car_powertrain
    );
    if emission_factor_g is null then
      raise check_violation using message = 'Unsupported transport configuration.';
    end if;
    new.carbon_emission := round((effective_distance_km * emission_factor_g) / 1000, 2);
  end if;

  new.total_emission := round(new.carbon_emission * new.passengers, 2);
  new.eco_points := private.trip_eco_score_change(
    new.transport_mode,
    new.distance_km,
    new.carbon_emission
  );
  return new;
end;
$$;

comment on column public.trips.route_legs is
  'Transitous journey legs used to calculate and display mixed-trip emissions.';

commit;
