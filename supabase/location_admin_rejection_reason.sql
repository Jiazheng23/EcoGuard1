-- Store the reason a super administrator rejects a location-admin application.
-- Run this file on databases that already applied admin_location_scope.sql.

alter table public.location_admin_applications
  add column if not exists rejection_reason text;

alter table public.location_admin_applications
  drop constraint if exists location_admin_applications_rejection_reason_check;

alter table public.location_admin_applications
  add constraint location_admin_applications_rejection_reason_check check (
    status <> 'rejected'
    or (rejection_reason is not null and char_length(trim(rejection_reason)) between 1 and 500)
  ) not valid;

-- Verification: should return the rejection_reason column.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'location_admin_applications'
  and column_name = 'rejection_reason';
