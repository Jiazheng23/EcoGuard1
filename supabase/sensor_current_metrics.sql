-- EcoGuard current sensor readings
-- Apply after admin_location_scope.sql and early_warning_notifications.sql.
-- The frontend updates the newest location_metrics row for each location.
-- Existing historical rows are preserved; this migration deletes no data.

begin;

do $$
begin
  if to_regclass('public.early_warning_alerts') is null
    or to_regprocedure('private.evaluate_environmental_thresholds()') is null then
    raise exception 'Apply supabase/early_warning_notifications.sql before sensor_current_metrics.sql.';
  end if;
end $$;

-- A single metric row can now move through several alert states over time, so
-- metric_id + category can no longer be globally unique across alert history.
alter table public.early_warning_alerts
  drop constraint if exists early_warning_alerts_metric_id_category_key;

create index if not exists early_warning_alerts_metric_id_idx
  on public.early_warning_alerts(metric_id);

create or replace function private.record_early_warning(
  target_location_id bigint,
  target_metric_id bigint,
  target_category text,
  target_severity text,
  target_title text,
  target_detail text,
  target_value numeric,
  target_threshold numeric,
  target_unit text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Keep an active warning current when the simulated value changes without
  -- creating another notification row for the same severity.
  update public.early_warning_alerts
  set metric_id = target_metric_id,
      title = target_title,
      detail = target_detail,
      current_value = target_value,
      threshold_value = target_threshold,
      unit = target_unit
  where location_id = target_location_id
    and category = target_category
    and severity = target_severity
    and resolved_at is null;

  if found then
    return;
  end if;

  update public.early_warning_alerts
  set resolved_at = now()
  where location_id = target_location_id
    and category = target_category
    and resolved_at is null
    and severity is distinct from target_severity;

  if target_severity is null then
    update public.early_warning_alerts
    set resolved_at = now()
    where location_id = target_location_id
      and category = target_category
      and resolved_at is null;
    return;
  end if;

  insert into public.early_warning_alerts (
    location_id, metric_id, category, severity, title, detail,
    current_value, threshold_value, unit
  ) values (
    target_location_id, target_metric_id, target_category, target_severity,
    target_title, target_detail, target_value, target_threshold, target_unit
  );
end;
$$;

revoke all on function private.record_early_warning(bigint, bigint, text, text, text, text, numeric, numeric, text)
  from public, anon, authenticated;

-- UPDATE is required because sensor cycles now mutate the current row instead
-- of inserting an unlimited sequence of snapshots.
drop trigger if exists location_metrics_generate_early_warnings
  on public.location_metrics;
create trigger location_metrics_generate_early_warnings
after insert or update on public.location_metrics
for each row execute function private.evaluate_environmental_thresholds();

commit;

-- Verification after applying:
-- 1. Open Sensors and leave one sensor online for at least two update cycles.
-- 2. Confirm the row count is unchanged while recorded_at and values change:
-- select id, location_id, crowd_count, waste_kg, recorded_at
-- from public.location_metrics
-- order by location_id, recorded_at desc;
