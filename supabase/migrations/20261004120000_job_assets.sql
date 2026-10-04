-- Build plan (2) Stage 3: job assets (files + allowlisted links), brief
-- versioning, link reports. Additive — Phases 0-7 untouched.

create table public.link_domain_allowlist (
  domain text primary key,
  category text,
  allowed_roles text[] not null default '{source}',
  notes text
);
alter table public.link_domain_allowlist enable row level security;
revoke all on public.link_domain_allowlist from anon, authenticated;
grant select on public.link_domain_allowlist to authenticated;
create policy "Signed-in read allowlist" on public.link_domain_allowlist
for select to authenticated using (true);
create policy "Admins manage allowlist" on public.link_domain_allowlist
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.link_domain_allowlist (domain, category, allowed_roles) values
  ('drive.google.com', 'Cloud storage', '{source}'),
  ('dropbox.com', 'Cloud storage', '{source}'),
  ('onedrive.live.com', 'Cloud storage', '{source}'),
  ('sharepoint.com', 'Cloud storage', '{source}'),
  ('youtube.com', 'Video', '{source,reference}'),
  ('youtu.be', 'Video', '{source,reference}'),
  ('vimeo.com', 'Video', '{source,reference}'),
  ('loom.com', 'Video', '{source,reference}'),
  ('figma.com', 'Design and docs', '{source,reference}'),
  ('canva.com', 'Design and docs', '{source,reference}'),
  ('docs.google.com', 'Design and docs', '{source,reference}'),
  ('notion.so', 'Design and docs', '{source,reference}'),
  ('notion.site', 'Design and docs', '{source,reference}'),
  ('tiktok.com', 'Social posts', '{reference}'),
  ('instagram.com', 'Social posts', '{reference}'),
  ('x.com', 'Social posts', '{reference}'),
  ('twitter.com', 'Social posts', '{reference}');

-- ---------------------------------------------------------------------------
-- job_assets
-- ---------------------------------------------------------------------------
create table public.job_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  role text not null default 'reference' check (role in ('source', 'reference')),
  label text check (char_length(label) <= 160),
  storage_path text check (char_length(storage_path) <= 500),
  url text check (char_length(url) <= 500),
  domain text check (char_length(domain) <= 160),
  mime_type text,
  size_bytes bigint,
  link_status text not null default 'unchecked' check (link_status in ('ok', 'inaccessible', 'blocked', 'unchecked')),
  link_checked_at timestamptz,
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'infected')),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index job_assets_job_idx on public.job_assets (job_id);

alter table public.job_assets enable row level security;
revoke all on public.job_assets from anon, authenticated;
grant select on public.job_assets to authenticated;

-- Managers see everything. Applicants see reference assets on open jobs or jobs
-- they applied to. Accepted talent also see source assets. Files are fetched via
-- server-signed URLs after the same check.
create policy "Read job assets by role and access"
on public.job_assets for select to authenticated
using (
  deleted_at is null and (
    (select public.manages_job(job_id))
    or (
      role = 'reference' and (
        exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open')
        or exists (select 1 from public.applications a where a.job_id = job_assets.job_id and a.user_id = (select auth.uid()))
      )
    )
    or (
      role = 'source'
      and exists (select 1 from public.applications a where a.job_id = job_assets.job_id and a.user_id = (select auth.uid()) and a.status = 'accepted')
    )
  )
);

-- ---------------------------------------------------------------------------
-- job_brief_versions + applications.brief_version_id
-- ---------------------------------------------------------------------------
create table public.job_brief_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  version integer not null,
  description_snapshot text,
  assets_snapshot jsonb not null default '[]',
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique (job_id, version)
);
alter table public.job_brief_versions enable row level security;
revoke all on public.job_brief_versions from anon, authenticated;
grant select on public.job_brief_versions to authenticated;
create policy "Read brief versions: manager, applicant, admin"
on public.job_brief_versions for select to authenticated
using (
  (select public.manages_job(job_id))
  or exists (select 1 from public.applications a where a.job_id = job_brief_versions.job_id and a.user_id = (select auth.uid()))
);

alter table public.applications add column brief_version_id uuid references public.job_brief_versions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- link_reports ("I can't open this")
-- ---------------------------------------------------------------------------
create table public.link_reports (
  id uuid primary key default gen_random_uuid(),
  job_asset_id uuid not null references public.job_assets (id) on delete cascade,
  reported_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.link_reports enable row level security;
revoke all on public.link_reports from anon, authenticated;
grant select, insert on public.link_reports to authenticated;
create policy "Read link reports: manager, reporter, admin"
on public.link_reports for select to authenticated
using (
  reported_by = (select auth.uid())
  or (select public.is_admin())
  or (select public.manages_job((select job_id from public.job_assets where id = link_reports.job_asset_id)))
);
create policy "Accepted talent reports a link"
on public.link_reports for insert to authenticated
with check (reported_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- job-assets storage bucket: managers write/read; talent reads via server-signed
-- URLs after the role/acceptance check.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-assets', 'job-assets', false, 52428800, null);

create policy "Managers upload job assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'job-assets' and (select public.manages_job(((storage.foldername(name))[1])::uuid)));
create policy "Managers read job assets, admins all"
on storage.objects for select to authenticated
using (bucket_id = 'job-assets' and ((select public.manages_job(((storage.foldername(name))[1])::uuid)) or (select public.is_admin())));
create policy "Managers delete job assets"
on storage.objects for delete to authenticated
using (bucket_id = 'job-assets' and (select public.manages_job(((storage.foldername(name))[1])::uuid)));
