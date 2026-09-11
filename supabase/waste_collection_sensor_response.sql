-- Apply AFTER waste_alert_workflow.sql, sensor_current_metrics.sql and
-- sensor_location_controls.sql. Existing historical records are not adjusted.
begin;

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = to_regclass('public.waste_collection_records') and tgname = 'waste_records_finish_schedule')
    or not exists (select 1 from pg_trigger where tgrelid = to_regclass('public.waste_collection_records') and tgname = 'waste_records_alert_link') then
    raise exception 'Apply waste_alert_workflow.sql first.';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = to_regclass('public.location_metrics')
    and tgname = 'location_metrics_generate_early_warnings' and (tgtype::integer & 16) = 16) then
    raise exception 'Apply sensor_current_metrics.sql first so reading changes reevaluate alerts.';
  end if;
end;
$$;

alter table public.waste_collection_records
  add column if not exists apply_to_sensor boolean not null default false,
  add column if not exists request_id uuid,
  add column if not exists sensor_waste_before numeric,
  add column if not exists sensor_waste_after numeric,
  add column if not exists sensor_recycled_before numeric,
  add column if not exists sensor_recycled_after numeric;
create unique index if not exists waste_collection_request_unique
  on public.waste_collection_records(request_id) where request_id is not null;

create or replace function public.apply_waste_collection_to_sensor()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  metric public.location_metrics%rowtype;
  waste_before numeric;
  recyclable_before numeric;
begin
  -- Audit values are computed by the database, never trusted from the client.
  new.sensor_waste_before := null;
  new.sensor_waste_after := null;
  new.sensor_recycled_before := null;
  new.sensor_recycled_after := null;
  if not new.apply_to_sensor then return new; end if;
  if not coalesce(public.can_manage_waste(new.location_id), false) then
    raise exception using errcode = '42501', message = 'You cannot manage waste for this location.';
  end if;
  if new.status not in ('completed', 'partial') or new.request_id is null then
    raise exception using errcode = '23514', message = 'Only completed or partial current collections can update readings and require a request ID.';
  end if;
  if new.collected_at < now() - interval '5 minutes' or new.collected_at > now() then
    raise exception using errcode = '23514', message = 'Use the current time for a current collection, or choose Historical record.';
  end if;
  select * into metric from public.location_metrics
    where location_id = new.location_id
    order by recorded_at desc, id desc limit 1 for update;
  if not found or metric.waste_kg is null or metric.recycled_kg is null then
    raise exception using errcode = '23514', message = 'No stored waste reading is available. Refresh Sensors or choose Historical record.';
  end if;
  waste_before := round(metric.waste_kg::numeric, 2);
  recyclable_before := round(metric.recycled_kg::numeric, 2);
  if new.total_kg <= 0 or new.recycled_kg < 0 or new.recycled_kg > new.total_kg then
    raise exception using errcode = '23514', message = 'Enter valid total and recycled collection quantities.';
  end if;
  if new.total_kg > waste_before then
    raise exception using errcode = '23514', message = 'Collected waste exceeds the current waste reading. Refresh and check the amount.';
  end if;
  if new.recycled_kg > recyclable_before then
    raise exception using errcode = '23514', message = 'Recycled amount exceeds the current recyclable material reading.';
  end if;
  if new.total_kg - new.recycled_kg > waste_before - recyclable_before then
    raise exception using errcode = '23514', message = 'Non-recycled collection exceeds the available non-recyclable waste. Check the recycled amount.';
  end if;
  new.sensor_waste_before := waste_before;
  new.sensor_waste_after := waste_before - new.total_kg;
  new.sensor_recycled_before := recyclable_before;
  new.sensor_recycled_after := recyclable_before - new.recycled_kg;
  update public.location_metrics
    set waste_kg = new.sensor_waste_after,
        recycled_kg = new.sensor_recycled_after,
        recorded_at = now()
    where id = metric.id;
  if not found then
    raise exception using errcode = '42501', message = 'Unable to update the waste reading for this location.';
  end if;
  -- Existing metric triggers reevaluate alerts. Other measured values are unchanged.
  return new;
end;
$$;
revoke all on function public.apply_waste_collection_to_sensor() from public;
drop trigger if exists waste_records_sensor_adjustment on public.waste_collection_records;
create trigger waste_records_sensor_adjustment before insert on public.waste_collection_records
  for each row execute function public.apply_waste_collection_to_sensor();

-- One endpoint for scheduled/unscheduled and current/historical results.
-- The existing alert and schedule triggers still enforce the workflow.
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
    (p_record->>'collected_at')::timestamptz, (p_record->>'total_kg')::numeric,
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
