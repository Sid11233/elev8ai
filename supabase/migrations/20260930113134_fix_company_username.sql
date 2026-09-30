-- Fix: company usernames must match ^[a-z0-9_]{3,20}$ (no hyphens).

create or replace function public.create_company(
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
  v_base text;         -- slug base (hyphens allowed)
  v_ubase text;        -- username base (underscores only)
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
  -- username: letters/digits/underscore only, 3-20 chars.
  v_ubase := regexp_replace(v_base, '-', '_', 'g');
  v_ubase := rpad(left(v_ubase, 20), 3, '0');
  v_username := left(v_ubase, 20);

  while exists (select 1 from public.companies where slug = v_slug) loop
    v_suffix := substr(md5(random()::text), 1, 4);
    v_slug := left(v_base, 55) || '-' || v_suffix;
  end loop;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := substr(md5(random()::text), 1, 4);
    v_username := left(v_ubase, 15) || v_suffix;
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
