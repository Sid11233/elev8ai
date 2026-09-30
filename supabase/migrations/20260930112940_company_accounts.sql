-- Phase C: self-serve company accounts. A company is a user (role 'company')
-- who owns a companies row. One login per company (owner_id unique).

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('talent', 'admin', 'company'));

alter table public.companies
  add column owner_id uuid unique references auth.users (id) on delete cascade,
  add column type text check (char_length(type) <= 60),
  add column phone text check (char_length(phone) <= 30),
  add column services text[] not null default '{}';

-- Company owners can edit their own company; admins still manage all.
create policy "Owners update own company"
on public.companies for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

-- Onboarding completeness now depends on role: companies don't need a DOB.
create or replace function public.check_profile_onboarding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.onboarded then
    if new.full_name is null or new.username is null then
      raise exception 'Profile is incomplete' using errcode = 'check_violation';
    end if;
    if new.role = 'company' then
      -- Companies just need a name + handle; the company row holds the rest.
      return new;
    end if;
    if new.date_of_birth is null or new.country is null then
      raise exception 'Profile is incomplete' using errcode = 'check_violation';
    end if;
    if new.date_of_birth > (current_date - interval '18 years')::date then
      raise exception 'You must be 18 or older to join Elev8ai' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Slugify helper for generating company slugs / usernames.
create function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g')), ''),
    'company'
  );
$$;

-- Creates a company for the current user and turns their account into a company.
create function public.create_company(
  p_name text,
  p_type text,
  p_phone text,
  p_services text[],
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(p_name);
  v_base text;
  v_slug text;
  v_username text;
  v_services text[] := coalesce(p_services, '{}');
  v_id uuid;
  v_suffix text;
begin
  if v_uid is null then
    raise exception 'Please log in';
  end if;
  if exists (select 1 from public.profiles where user_id = v_uid and onboarded) then
    raise exception 'Your account is already set up';
  end if;
  if exists (select 1 from public.companies where owner_id = v_uid) then
    raise exception 'You already have a company';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Enter your company name';
  end if;
  if v_services <@ array['clipping','cold_calling','content','web_dev'] is not true then
    raise exception 'Invalid service';
  end if;

  v_base := public.slugify(v_name);
  v_slug := v_base;
  v_username := left(v_base, 20);
  -- Ensure uniqueness with a short random suffix if needed.
  while exists (select 1 from public.companies where slug = v_slug) loop
    v_suffix := substr(md5(random()::text), 1, 4);
    v_slug := left(v_base, 55) || '-' || v_suffix;
  end loop;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := substr(md5(random()::text), 1, 4);
    v_username := left(v_base, 15) || v_suffix;
  end loop;

  insert into public.companies (name, slug, owner_id, type, phone, services, description)
  values (v_name, v_slug, v_uid, nullif(btrim(p_type), ''), nullif(btrim(p_phone), ''),
          v_services, nullif(btrim(p_description), ''))
  returning id into v_id;

  update public.profiles
  set role = 'company', full_name = v_name, username = v_username, onboarded = true
  where user_id = v_uid;

  return v_id;
end;
$$;

revoke execute on function public.create_company(text, text, text, text[], text) from public, anon;
grant execute on function public.create_company(text, text, text, text[], text) to authenticated;
revoke execute on function public.slugify(text) from public, anon;
grant execute on function public.slugify(text) to authenticated;
