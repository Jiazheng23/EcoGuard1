-- Apply after waste_management.sql and early_warning_notifications.sql.
-- Adds traceable responses without changing sensor readings or resolving alerts.
begin;

alter table public.waste_collection_schedules
  add column if not exists alert_id bigint references public.early_warning_alerts(id) on delete restrict;
alter table public.waste_collection_records
  add column if not exists alert_id bigint references public.early_warning_alerts(id) on delete restrict;

create index if not exists waste_records_alert_idx on public.waste_collection_records(alert_id);
create index if not exists waste_schedules_alert_idx on public.waste_collection_schedules(alert_id);
create unique index if not exists waste_one_active_schedule_per_alert_idx
  on public.waste_collection_schedules(alert_id) where status = 'scheduled' and alert_id is not null;

create or replace function public.validate_waste_alert_link()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  alert_row public.early_warning_alerts%rowtype;
  schedule_row public.waste_collection_schedules%rowtype;
begin
  if tg_table_name = 'waste_collection_schedules' then
    if tg_op = 'UPDATE' then
      if old.alert_id is not null and new.alert_id is distinct from old.alert_id then
        raise exception using errcode = '23514', message = 'An existing alert link cannot be removed or replaced.';
      end if;
      if old.status <> 'scheduled' then
        raise exception using errcode = '23514', message = 'Completed, missed and cancelled schedules are retained as history and cannot be changed.';
      end if;
    end if;
    if new.status in ('completed', 'missed') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      if not exists (
        select 1 from public.waste_collection_records
        where schedule_id = new.id and location_id = new.location_id
          and case when status = 'missed' then 'missed' else 'completed' end = new.status
      ) then
        raise exception using errcode = '23514', message = 'Record a collection result to complete a schedule or mark it missed.';
      end if;
    end if;
  end if;

  if tg_table_name = 'waste_collection_records' then
    if new.status = 'missed' and length(btrim(coalesce(new.notes, ''))) = 0 then
      raise exception using errcode = '23514', message = 'Enter a reason for a missed collection.';
    end if;
    if new.schedule_id is not null then
      select * into schedule_row from public.waste_collection_schedules where id = new.schedule_id for update;
      if not found or schedule_row.location_id <> new.location_id or schedule_row.status <> 'scheduled' then
        raise exception using errcode = '23514', message = 'Choose an active schedule for the same location.';
      end if;
      if new.waste_type <> schedule_row.waste_type then
        raise exception using errcode = '23514', message = 'The collection waste type must match its schedule.';
      end if;
      if new.status = 'missed' and (schedule_row.scheduled_until > now() or new.collected_at < schedule_row.scheduled_until) then
        raise exception using errcode = '23514', message = 'A schedule can only be marked missed after its collection window ends.';
      end if;
      if new.alert_id is not null and new.alert_id is distinct from schedule_row.alert_id then
        raise exception using errcode = '23514', message = 'The collection alert must match its schedule.';
      end if;
      -- The existing completion RPC inherits the link inside the same transaction.
      new.alert_id := schedule_row.alert_id;
    end if;
  end if;

  if new.alert_id is null then return new; end if;
  if not coalesce(public.can_manage_waste(new.location_id), false) then
    raise exception using errcode = '42501', message = 'You cannot manage waste for this location.';
  end if;
  -- Serialize responses to the same alert without requiring UPDATE access to alerts.
  perform pg_catalog.pg_advisory_xact_lock(new.alert_id);
  select * into alert_row from public.early_warning_alerts where id = new.alert_id;
  if not found or alert_row.category <> 'waste' or alert_row.location_id <> new.location_id then
    raise exception using errcode = '23514', message = 'Choose a waste alert from the same location.';
  end if;
  if tg_table_name = 'waste_collection_schedules' then
    if (tg_op = 'INSERT' or old.alert_id is distinct from new.alert_id) and alert_row.resolved_at is not null then
      raise exception using errcode = '23514', message = 'This alert has already resolved. Refresh the alert list.';
    end if;
  elsif new.schedule_id is null then
    if alert_row.resolved_at is not null then
      raise exception using errcode = '23514', message = 'This alert has already resolved. Refresh the alert list.';
    end if;
    if exists (select 1 from public.waste_collection_schedules where alert_id = new.alert_id and status = 'scheduled') then
      raise exception using errcode = '23514', message = 'Record this collection through the existing linked schedule.';
    end if;
  end if;
  if tg_table_name = 'waste_collection_records' then
    if new.collected_at < alert_row.created_at then
      raise exception using errcode = '23514', message = 'The collection time cannot be before the linked alert.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_waste_alert_link() from public;

drop trigger if exists waste_schedules_alert_link on public.waste_collection_schedules;
create trigger waste_schedules_alert_link before insert or update on public.waste_collection_schedules
  for each row execute function public.validate_waste_alert_link();
drop trigger if exists waste_records_alert_link on public.waste_collection_records;
create trigger waste_records_alert_link before insert on public.waste_collection_records
  for each row execute function public.validate_waste_alert_link();

-- Also keep schedule status consistent if an authenticated client inserts directly.
create or replace function public.finish_waste_schedule_from_record()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.schedule_id is not null then
    update public.waste_collection_schedules
      set status = case when new.status = 'missed' then 'missed' else 'completed' end,
          updated_by = auth.uid()
      where id = new.schedule_id and status = 'scheduled';
  end if;
  return new;
end;
$$;
revoke all on function public.finish_waste_schedule_from_record() from public;
drop trigger if exists waste_records_finish_schedule on public.waste_collection_records;
create trigger waste_records_finish_schedule after insert on public.waste_collection_records
  for each row execute function public.finish_waste_schedule_from_record();

-- Preserve the existing API signature. The insert trigger now owns the atomic
-- schedule transition for both RPC calls and direct authenticated inserts.
create or replace function public.complete_waste_collection(
  p_schedule_id bigint,
  p_collected_at timestamptz,
  p_total_kg numeric,
  p_recycled_kg numeric,
  p_status text,
  p_source text,
  p_notes text default null
)
returns public.waste_collection_records
language plpgsql security invoker set search_path = '' as $$
declare
  schedule_row public.waste_collection_schedules%rowtype;
  collection_row public.waste_collection_records%rowtype;
begin
  select * into schedule_row from public.waste_collection_schedules
    where id = p_schedule_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Waste collection schedule was not found.';
  end if;
  if not coalesce(public.can_manage_waste(schedule_row.location_id), false) then
    raise exception using errcode = '42501', message = 'You cannot manage waste for this location.';
  end if;
  if schedule_row.status <> 'scheduled' then
    raise exception using errcode = '23514', message = 'Only an active scheduled collection can be completed or marked missed.';
  end if;
  insert into public.waste_collection_records (
    schedule_id, location_id, collected_at, total_kg, recycled_kg,
    waste_type, status, source, notes, recorded_by
  ) values (
    schedule_row.id, schedule_row.location_id, p_collected_at, p_total_kg, p_recycled_kg,
    schedule_row.waste_type, p_status, p_source, nullif(btrim(p_notes), ''), auth.uid()
  ) returning * into collection_row;
  return collection_row;
end;
$$;
revoke all on function public.complete_waste_collection(bigint, timestamptz, numeric, numeric, text, text, text) from public;
grant execute on function public.complete_waste_collection(bigint, timestamptz, numeric, numeric, text, text, text) to authenticated;

-- Enable cross-session updates; the UI also polls if Realtime is unavailable.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach table_name in array array['waste_collection_schedules', 'waste_collection_records'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

-- Existing RLS/grants continue to enforce assigned-location access. No new
-- alert-update permission is granted. Overdue is derived from scheduled_until.
notify pgrst, 'reload schema';
commit;
