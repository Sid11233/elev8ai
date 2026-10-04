-- Build plan (2) Stage 5: job posting flow additions — proof templates, storage
-- quota, and automatic brief versioning on acceptance / later edits.
-- Additive — Phases 0-7 untouched.

-- ---------------------------------------------------------------------------
-- proof_templates: a pre-fill checklist per category.
-- ---------------------------------------------------------------------------
create table public.proof_templates (
  category text primary key references public.job_categories (slug) on delete cascade,
  checklist_text text not null check (char_length(checklist_text) <= 3000)
);
alter table public.proof_templates enable row level security;
revoke all on public.proof_templates from anon, authenticated;
grant select on public.proof_templates to authenticated;
create policy "Signed-in read proof templates" on public.proof_templates
for select to authenticated using (true);
create policy "Admins manage proof templates" on public.proof_templates
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

insert into public.proof_templates (category, checklist_text)
select slug,
  case proof_type
    when 'file_watermarked' then
      'Upload the finished file(s) here. Do not share a link — the full-quality version stays locked until payment is confirmed.'
    when 'file_staging' then
      'Upload or host a working preview the company can review. Source files and full access stay with you until payment is confirmed.'
    when 'verified_event' then
      'Share the Calendly booking link or confirmation for the event you completed.'
    when 'verified_publish' then
      'Share the public URL where the content is now live.'
  end
from public.job_categories;

-- ---------------------------------------------------------------------------
-- companies.storage_quota_bytes: cap on job-asset storage per company.
-- ---------------------------------------------------------------------------
alter table public.companies
  add column storage_quota_bytes bigint not null default 2147483648; -- 2 GB default

-- ---------------------------------------------------------------------------
-- Automatic brief versioning: snapshot v1 on acceptance; later edits to the
-- description create a new version once an accepted application exists.
-- ---------------------------------------------------------------------------
create or replace function public.snapshot_brief_on_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_next_version integer;
  v_brief_id uuid;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select * into v_job from public.jobs where id = new.job_id;
    select coalesce(max(version), 0) + 1 into v_next_version
    from public.job_brief_versions where job_id = new.job_id;

    insert into public.job_brief_versions (job_id, version, description_snapshot, assets_snapshot, acknowledged_at)
    values (
      new.job_id, v_next_version, v_job.description,
      coalesce((select jsonb_agg(to_jsonb(a)) from public.job_assets a where a.job_id = new.job_id and a.deleted_at is null), '[]'),
      now() -- acceptance itself is the acknowledgment of the current brief
    )
    returning id into v_brief_id;

    new.brief_version_id := v_brief_id;
  end if;
  return new;
end;
$$;

create trigger applications_snapshot_brief
before update of status on public.applications
for each row execute function public.snapshot_brief_on_acceptance();

-- A later edit to the description (after any acceptance exists) creates a new,
-- unacknowledged version — the talent must acknowledge it in the app.
create or replace function public.version_brief_on_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next_version integer;
  v_has_accepted boolean;
begin
  if new.description is distinct from old.description then
    select exists (select 1 from public.applications where job_id = new.id and status = 'accepted')
      into v_has_accepted;
    if v_has_accepted then
      select coalesce(max(version), 0) + 1 into v_next_version
      from public.job_brief_versions where job_id = new.id;
      insert into public.job_brief_versions (job_id, version, description_snapshot, assets_snapshot)
      values (
        new.id, v_next_version, new.description,
        coalesce((select jsonb_agg(to_jsonb(a)) from public.job_assets a where a.job_id = new.id and a.deleted_at is null), '[]')
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_version_brief_on_edit
after update of description on public.jobs
for each row execute function public.version_brief_on_edit();

-- Talent acknowledges a new brief version.
create function public.acknowledge_brief_version(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications%rowtype;
  v_latest uuid;
begin
  select * into v_app from public.applications where id = p_application_id and user_id = (select auth.uid());
  if not found then
    raise exception 'Application not found';
  end if;
  select id into v_latest from public.job_brief_versions
  where job_id = v_app.job_id order by version desc limit 1;
  update public.job_brief_versions set acknowledged_at = now() where id = v_latest and acknowledged_at is null;
  update public.applications set brief_version_id = v_latest where id = p_application_id;
end;
$$;
revoke execute on function public.acknowledge_brief_version(uuid) from public, anon;
grant execute on function public.acknowledge_brief_version(uuid) to authenticated;
