-- Fix clock skew in Current collection submissions. Apply after
-- waste_collection_sensor_response.sql. Safe to rerun; no existing rows changed.
begin;
do $$
begin
  if to_regprocedure('public.record_waste_collection(jsonb,uuid)') is null then
    raise exception 'Apply waste_collection_sensor_response.sql first.';
  end if;
end;
$$;

create or replace function public.record_waste_collection(p_record jsonb, p_request_id uuid)
returns public.waste_collection_records
language plpgsql security invoker set search_path = '' as $$
declare
  result public.waste_collection_records%rowtype;
  schedule public.waste_collection_schedules%rowtype;
  location_id_value bigint := (p_record->>'location_id')::bigint;
  schedule_id_value bigint := (p_record->>'schedule_id')::bigint;
begin
  if p_request_id is null then
    raise exception using errcode = '23514', message = 'A collection request ID is required.';
  end if;
  if not coalesce(public.can_manage_waste(location_id_value), false) then
    raise exception using errcode = '42501', message = 'You cannot manage waste for this location.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into result from public.waste_collection_records where request_id = p_request_id;
  if found then
    if result.recorded_by <> auth.uid() or result.location_id <> location_id_value then
      raise exception using errcode = '42501', message = 'This request ID belongs to a different collection.';
    end if;
    return result;
  end if;
  if schedule_id_value is not null then
    select * into schedule from public.waste_collection_schedules where id = schedule_id_value for update;
    if not found or schedule.location_id <> location_id_value or schedule.status <> 'scheduled' then
      raise exception using errcode = '23514', message = 'Choose an active schedule for the same location.';
    end if;
  end if;
  insert into public.waste_collection_records (
    location_id, schedule_id, alert_id, collected_at, total_kg, recycled_kg,
    waste_type, status, source, notes, recorded_by, apply_to_sensor, request_id
  ) values (
    location_id_value, schedule_id_value, (p_record->>'alert_id')::bigint,
    -- Current collections use the same database transaction clock as validation
    -- triggers. Historical entries retain their explicit user-entered time.
    case when coalesce((p_record->>'apply_to_sensor')::boolean, false)
      then now() else (p_record->>'collected_at')::timestamptz end,
    (p_record->>'total_kg')::numeric,
    (p_record->>'recycled_kg')::numeric, p_record->>'waste_type', p_record->>'status',
    p_record->>'source', nullif(btrim(p_record->>'notes'), ''), auth.uid(),
    coalesce((p_record->>'apply_to_sensor')::boolean, false), p_request_id
  ) returning * into result;
  return result;
end;
$$;
revoke all on function public.record_waste_collection(jsonb, uuid) from public;
grant execute on function public.record_waste_collection(jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;

