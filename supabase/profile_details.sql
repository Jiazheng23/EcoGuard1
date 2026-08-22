-- EcoGuard profile details migration
-- Copy and run the SQL statements in this file inside Supabase SQL Editor.
-- Do not enter the file path itself as a SQL query.

alter table public.profiles
  add column if not exists gender text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_gender_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (
        gender is null
        or gender = any (
          array[
            'female'::text,
            'male'::text,
            'non_binary'::text,
            'prefer_not_to_say'::text
          ]
        )
      );
  end if;
end
$$;

comment on column public.profiles.gender is
  'Optional self-described gender used by the EcoGuard profile form.';
