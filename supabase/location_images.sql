-- Ecological location wallpaper and gallery images.
-- Run after supabase/admin_location_scope.sql.

alter table public.ecological_locations
  add column if not exists wallpaper_url text,
  add column if not exists gallery_urls text[] not null default '{}';

-- Only super administrators choose the wallpaper. Location administrators can
-- still maintain gallery_urls for their assigned location through the normal RLS policy.
create or replace function public.protect_location_wallpaper_selection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and old.wallpaper_url is distinct from new.wallpaper_url
    and (select public.current_app_role()) <> 'super_admin'
  then
    raise exception 'Only a super administrator can select a location wallpaper.';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_location_wallpaper_selection() from public;
drop trigger if exists protect_location_wallpaper_selection on public.ecological_locations;
create trigger protect_location_wallpaper_selection
before update of wallpaper_url on public.ecological_locations
for each row execute function public.protect_location_wallpaper_selection();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'location-images',
  'location-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists location_images_admin_insert on storage.objects;
drop policy if exists location_images_admin_update on storage.objects;
drop policy if exists location_images_admin_delete on storage.objects;

create policy location_images_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'location-images'
  and (
    (select public.current_app_role()) = 'super_admin'
    or (
      (select public.current_app_role()) = 'location_admin'
      and (storage.foldername(name))[1] = (select public.current_location_id())::text
    )
  )
);

create policy location_images_admin_update on storage.objects
for update to authenticated
using (
  bucket_id = 'location-images'
  and (
    (select public.current_app_role()) = 'super_admin'
    or (storage.foldername(name))[1] = (select public.current_location_id())::text
  )
)
with check (
  bucket_id = 'location-images'
  and (
    (select public.current_app_role()) = 'super_admin'
    or (storage.foldername(name))[1] = (select public.current_location_id())::text
  )
);

create policy location_images_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'location-images'
  and (
    (select public.current_app_role()) = 'super_admin'
    or (storage.foldername(name))[1] = (select public.current_location_id())::text
  )
);
