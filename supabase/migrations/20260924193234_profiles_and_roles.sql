-- Phase 1a: profiles, roles, is_admin(), avatars bucket.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'talent' check (role in ('talent', 'admin')),
  full_name text check (char_length(full_name) <= 100),
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  avatar_url text,
  country text check (char_length(country) <= 60),
  date_of_birth date,
  phone text check (char_length(phone) <= 30),
  bio text check (char_length(bio) <= 500),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One per auth user. role is set by hand in SQL for admins.';

-- Shared helper: keep updated_at current on any table that has it.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- A profile can only be marked onboarded when it is complete and the user is
-- 18 or older. Enforced here so it cannot be bypassed from the client.
create function public.check_profile_onboarding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.onboarded then
    if new.full_name is null or new.username is null
       or new.date_of_birth is null or new.country is null then
      raise exception 'Profile is incomplete' using errcode = 'check_violation';
    end if;
    if new.date_of_birth > (current_date - interval '18 years')::date then
      raise exception 'You must be 18 or older to join Elev8ai' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_check_onboarding
before insert or update on public.profiles
for each row execute function public.check_profile_onboarding();

-- ---------------------------------------------------------------------------
-- Create a profile for every new auth user (email or Google).
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 100),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin(): used by RLS policies on every table.
-- security definer so it can read profiles without recursing into RLS.
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Column-level privileges: users may only update these columns, so they can
-- never change role, user_id or timestamps, whatever the RLS policy allows.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, username, avatar_url, country, date_of_birth, phone, bio, onboarded)
  on public.profiles to authenticated;

create policy "Users read own profile, admins read all"
on public.profiles for select
to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users update own profile"
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- avatars bucket: public read, users write only inside "<their user id>/"
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Users read own avatar folder"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users upload to own avatar folder"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update own avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete own avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
