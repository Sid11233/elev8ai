-- Phase 2a: companies, skills, user_skills (badges), jobs, company-logos bucket.

-- ---------------------------------------------------------------------------
-- companies: admin-managed records (not user accounts in the MVP)
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  description text check (char_length(description) <= 2000),
  website text check (char_length(website) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- skills and user_skills: a user_skills row is a badge
-- ---------------------------------------------------------------------------
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create table public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  source text not null check (source in ('course', 'manual')),
  awarded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, skill_id)
);

create index user_skills_skill_id_idx on public.user_skills (skill_id);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) <= 5000),
  category text not null check (category in ('clipping', 'cold_calling', 'content', 'web_dev')),
  pay_cents integer not null check (pay_cents > 0),
  pay_type text not null check (pay_type in ('fixed', 'per_unit')),
  unit_label text check (char_length(unit_label) <= 30),
  max_units integer check (max_units > 0),
  slots integer not null default 1 check (slots > 0),
  required_skill_id uuid references public.skills (id) on delete restrict,
  deadline timestamptz,
  proof_instructions text not null default '' check (char_length(proof_instructions) <= 3000),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Per-unit jobs need to say what a unit is and cap how many get paid.
  constraint jobs_per_unit_fields check (
    pay_type = 'fixed' or (unit_label is not null and max_units is not null)
  )
);

comment on column public.jobs.required_skill_id is 'Badge needed to apply. Null = open to everyone.';
comment on column public.jobs.pay_cents is 'Fixed: total pay. Per unit: pay per unit, capped at max_units.';

create index jobs_status_category_idx on public.jobs (status, category);
create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_required_skill_id_idx on public.jobs (required_skill_id);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- Stamp the first time a job goes live (drives "new job" sorting and alerts).
create function public.set_job_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'open' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger jobs_set_published_at
before insert or update of status on public.jobs
for each row execute function public.set_job_published_at();

-- ---------------------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.skills enable row level security;
alter table public.user_skills enable row level security;
alter table public.jobs enable row level security;

revoke all on public.companies, public.skills, public.user_skills, public.jobs from anon;
revoke all on public.companies, public.skills, public.user_skills, public.jobs from authenticated;
grant select, insert, update, delete
  on public.companies, public.skills, public.user_skills, public.jobs
  to authenticated;

-- companies and skills: every signed-in user reads; only admins write.
create policy "Signed-in users read companies"
on public.companies for select to authenticated using (true);

create policy "Admins manage companies"
on public.companies for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Signed-in users read skills"
on public.skills for select to authenticated using (true);

create policy "Admins manage skills"
on public.skills for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- user_skills: users see their own badges; badges are only granted by admins
-- (and, from Phase 6, by the grading function).
create policy "Users read own badges, admins read all"
on public.user_skills for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins manage badges"
on public.user_skills for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- jobs: talent see open jobs only; admins see and manage everything.
create policy "Signed-in users read open jobs, admins read all"
on public.jobs for select to authenticated
using (status = 'open' or (select public.is_admin()));

create policy "Admins manage jobs"
on public.jobs for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- company-logos bucket: public read, admin-only writes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos', 'company-logos', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "Admins upload company logos"
on storage.objects for insert to authenticated
with check (bucket_id = 'company-logos' and (select public.is_admin()));

create policy "Admins update company logos"
on storage.objects for update to authenticated
using (bucket_id = 'company-logos' and (select public.is_admin()))
with check (bucket_id = 'company-logos' and (select public.is_admin()));

create policy "Admins delete company logos"
on storage.objects for delete to authenticated
using (bucket_id = 'company-logos' and (select public.is_admin()));

create policy "Admins list company logos"
on storage.objects for select to authenticated
using (bucket_id = 'company-logos' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Launch data: the four skills and four companies (edit in /admin/companies)
-- ---------------------------------------------------------------------------
insert into public.skills (slug, name, description) values
  ('clipping', 'Clipping', 'Cut long videos into short, hook-first clips with clean captions.'),
  ('cold_calling', 'Cold Calling', 'Research prospects, open calls, handle objections and book meetings.'),
  ('content', 'Content Creation', 'Shoot and edit short-form product content that fits a brand.'),
  ('web_dev', 'Web Development', 'Build and fix small website features.');

insert into public.companies (name, slug, description) values
  ('My Agency', 'my-agency', 'Placeholder: cold calling, content and clipping for agency clients.'),
  ('My Podcast', 'my-podcast', 'Placeholder: turn podcast episodes into short clips.'),
  ('My Clothing Brand', 'my-clothing-brand', 'Placeholder: short-form product content for the brand.'),
  ('Web Dev Agency', 'web-dev-agency', 'Placeholder: small, badge-gated web development tasks.');
