-- Build plan (2) Stage 2: company-visible talent profiles, certificates, and a
-- portfolio. Additive — Phases 0-7 untouched.

-- ---------------------------------------------------------------------------
-- company_can_view_talent: a company may see a talent's rich profile only while
-- that talent has a pending or accepted application on one of its jobs.
-- ---------------------------------------------------------------------------
create function public.company_can_view_talent(p_talent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    join public.companies c on c.id = j.company_id
    where a.user_id = p_talent_id
      and c.owner_id = (select auth.uid())
      and a.status in ('pending', 'accepted')
  );
$$;
revoke execute on function public.company_can_view_talent(uuid) from public, anon;
grant execute on function public.company_can_view_talent(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('platform', 'external')),
  title text not null check (char_length(title) between 2 and 160),
  issuer text check (char_length(issuer) <= 160),
  issued_at date,
  course_id uuid references public.courses (id) on delete set null,
  verify_token text unique,
  file_path text check (char_length(file_path) <= 500),
  status text not null default 'valid' check (status in ('valid', 'revoked', 'pending')),
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index certificates_user_idx on public.certificates (user_id);

alter table public.certificates enable row level security;
revoke all on public.certificates from anon, authenticated;
grant select, insert, update on public.certificates to authenticated;

create policy "Read certificates: owner, viewing company, admin"
on public.certificates for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (select public.company_can_view_talent(user_id))
);
create policy "Talent inserts own external certificates"
on public.certificates for insert to authenticated
with check (user_id = (select auth.uid()) and kind = 'external');
create policy "Owner or admin updates certificates"
on public.certificates for update to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- portfolio_items (new subsystem). Originals stay private; companies see the
-- watermarked preview only.
-- ---------------------------------------------------------------------------
create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 160),
  description text check (char_length(description) <= 1000),
  kind text not null default 'image' check (kind in ('image', 'pdf', 'link')),
  file_path text check (char_length(file_path) <= 500),
  preview_path text check (char_length(preview_path) <= 500),
  url text check (char_length(url) <= 500),
  visibility text not null default 'companies' check (visibility in ('companies', 'private')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index portfolio_items_user_idx on public.portfolio_items (user_id);

alter table public.portfolio_items enable row level security;
revoke all on public.portfolio_items from anon, authenticated;
grant select, insert, update, delete on public.portfolio_items to authenticated;

create policy "Read portfolio: owner, viewing company (shared only), admin"
on public.portfolio_items for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (visibility = 'companies' and (select public.company_can_view_talent(user_id)))
);
create policy "Owner writes own portfolio"
on public.portfolio_items for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Owner updates own portfolio"
on public.portfolio_items for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner deletes own portfolio"
on public.portfolio_items for delete to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- profile_views: audit log of company views of a talent profile.
-- ---------------------------------------------------------------------------
create table public.profile_views (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid references auth.users (id) on delete set null,
  talent_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  created_at timestamptz not null default now()
);
create index profile_views_talent_idx on public.profile_views (talent_id);

alter table public.profile_views enable row level security;
revoke all on public.profile_views from anon, authenticated;
grant select on public.profile_views to authenticated;
create policy "Admins read profile views"
on public.profile_views for select to authenticated using ((select public.is_admin()));

-- Consent: record when a talent applied (and thereby consented to profile view).
alter table public.applications
  add column profile_consent_at timestamptz;

create or replace function public.set_application_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_consent_at is null then
    new.profile_consent_at := now();
  end if;
  return new;
end;
$$;
create trigger applications_set_consent
before insert on public.applications
for each row execute function public.set_application_consent();

-- ---------------------------------------------------------------------------
-- Platform certificate issued automatically when a course badge is awarded.
-- (Additive trigger — the Phase 6 grading function is not modified.)
-- ---------------------------------------------------------------------------
create function public.issue_platform_certificate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses%rowtype;
  v_skill_name text;
begin
  if new.source = 'admin' then
    return new; -- manual grants don't get a course certificate
  end if;
  select * into v_course from public.courses where skill_id = new.skill_id and published order by created_at limit 1;
  select name into v_skill_name from public.skills where id = new.skill_id;
  insert into public.certificates (user_id, kind, title, issuer, issued_at, course_id, verify_token, status)
  values (
    new.user_id, 'platform',
    coalesce(v_course.title, v_skill_name, 'Course') || ' certificate',
    'lockedinnn', current_date, v_course.id,
    replace(gen_random_uuid()::text, '-', ''), 'valid'
  );
  return new;
end;
$$;
create trigger user_skills_issue_certificate
after insert on public.user_skills
for each row execute function public.issue_platform_certificate();

-- ---------------------------------------------------------------------------
-- Buckets: portfolio originals (private), portfolio previews (company-readable
-- via gate), certificate files.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('portfolio', 'portfolio', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('portfolio-previews', 'portfolio-previews', false, 10485760, array['image/png','application/pdf']),
  ('certificates', 'certificates', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']);

-- Portfolio originals: owner + admin only.
create policy "Users manage own portfolio files"
on storage.objects for insert to authenticated
with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users read own portfolio files, admins all"
on storage.objects for select to authenticated
using (bucket_id = 'portfolio' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy "Users delete own portfolio files"
on storage.objects for delete to authenticated
using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Portfolio previews: owner, admin, and a company that can view the talent.
create policy "Read portfolio previews: owner, company, admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'portfolio-previews'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
    or (select public.company_can_view_talent(((storage.foldername(name))[1])::uuid))
  )
);

-- Certificate files: owner uploads; owner, admin, and viewing company read.
create policy "Users upload own certificate files"
on storage.objects for insert to authenticated
with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Read certificate files: owner, company, admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'certificates'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
    or (select public.company_can_view_talent(((storage.foldername(name))[1])::uuid))
  )
);
