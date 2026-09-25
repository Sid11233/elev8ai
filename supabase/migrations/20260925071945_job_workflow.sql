-- Phase 3a: applications, submissions, payouts, submissions bucket.
-- Talent never write these tables directly: every state change goes through a
-- security-definer function below that checks who is calling and whether the
-- transition is allowed.

-- ---------------------------------------------------------------------------
-- jobs: track accepted workers so talent can see spots left
-- ---------------------------------------------------------------------------
alter table public.jobs
  add column spots_taken integer not null default 0 check (spots_taken >= 0);

comment on column public.jobs.spots_taken is 'Accepted applications. Maintained by decide_application().';

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  pitch text check (char_length(pitch) <= 1000),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  decision_note text check (char_length(decision_note) <= 1000),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, user_id)
);

create index applications_user_id_idx on public.applications (user_id);
create index applications_status_idx on public.applications (status);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- submissions: proof of work; a new row per attempt
-- ---------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  notes text check (char_length(notes) <= 2000),
  links text[] not null default '{}',
  file_paths text[] not null default '{}',
  units_claimed integer check (units_claimed > 0),
  units_approved integer check (units_approved > 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'changes_requested', 'approved', 'rejected')),
  reviewer_note text check (char_length(reviewer_note) <= 2000),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index submissions_application_id_idx on public.submissions (application_id);
create index submissions_status_idx on public.submissions (status);
-- Only one submission per application can be waiting for review.
create unique index submissions_one_pending_idx
  on public.submissions (application_id) where status = 'submitted';

-- ---------------------------------------------------------------------------
-- payouts: created owed on approval, marked paid by admin
-- ---------------------------------------------------------------------------
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  submission_id uuid not null unique references public.submissions (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'owed' check (status in ('owed', 'paid')),
  method text check (char_length(method) <= 30),
  reference text check (char_length(reference) <= 200),
  paid_at timestamptz,
  paid_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint payouts_paid_fields check (status = 'owed' or (paid_at is not null and method is not null))
);

create index payouts_user_id_idx on public.payouts (user_id);
create index payouts_status_idx on public.payouts (status);

-- ---------------------------------------------------------------------------
-- RLS: read own rows (admins read all); no direct writes for anyone but
-- the service role. Writes happen in the functions below.
-- ---------------------------------------------------------------------------
alter table public.applications enable row level security;
alter table public.submissions enable row level security;
alter table public.payouts enable row level security;

revoke all on public.applications, public.submissions, public.payouts from anon, authenticated;
grant select on public.applications, public.submissions, public.payouts to authenticated;

create policy "Users read own applications, admins read all"
on public.applications for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users read own submissions, admins read all"
on public.submissions for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users read own payouts, admins read all"
on public.payouts for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Applicants keep seeing a job after it closes (My Jobs, submissions).
drop policy "Signed-in users read open jobs, admins read all" on public.jobs;
create policy "Users read open jobs and jobs they applied to, admins read all"
on public.jobs for select to authenticated
using (
  status = 'open'
  or (select public.is_admin())
  or exists (
    select 1 from public.applications a
    where a.job_id = jobs.id and a.user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Workflow functions. Errors use plain messages shown to the user as-is.
-- ---------------------------------------------------------------------------

-- Talent: apply to an open job (or re-apply after withdrawing).
create function public.apply_to_job(p_job_id uuid, p_pitch text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.jobs%rowtype;
  v_existing public.applications%rowtype;
  v_skill_name text;
  v_pitch text := nullif(btrim(p_pitch), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please log in to apply';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_uid and onboarded) then
    raise exception 'Finish setting up your profile before applying';
  end if;
  if char_length(v_pitch) > 1000 then
    raise exception 'Keep your pitch under 1000 characters';
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.status <> 'open' then
    raise exception 'This job is not taking applications';
  end if;
  if v_job.deadline is not null and v_job.deadline < now() then
    raise exception 'The deadline for this job has passed';
  end if;
  if v_job.spots_taken >= v_job.slots then
    raise exception 'All spots for this job are taken';
  end if;
  if v_job.required_skill_id is not null and not exists (
    select 1 from public.user_skills
    where user_id = v_uid and skill_id = v_job.required_skill_id
  ) then
    select name into v_skill_name from public.skills where id = v_job.required_skill_id;
    raise exception 'You need the % badge to apply for this job', v_skill_name;
  end if;

  select * into v_existing from public.applications
  where job_id = p_job_id and user_id = v_uid;
  if found then
    if v_existing.status <> 'withdrawn' then
      raise exception 'You have already applied to this job';
    end if;
    update public.applications
    set status = 'pending', pitch = v_pitch, decision_note = null, decided_at = null, decided_by = null
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.applications (job_id, user_id, pitch)
  values (p_job_id, v_uid, v_pitch)
  returning id into v_id;
  return v_id;
end;
$$;

-- Talent: withdraw a pending application.
create function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.applications
  set status = 'withdrawn'
  where id = p_application_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Only pending applications can be withdrawn';
  end if;
end;
$$;

-- Admin: accept or reject a pending application. Accepting takes a spot and
-- closes the job when the last spot is filled.
create function public.decide_application(
  p_application_id uuid,
  p_accept boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review applications';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found or v_app.status <> 'pending' then
    raise exception 'This application has already been decided';
  end if;

  if p_accept then
    select * into v_job from public.jobs where id = v_app.job_id for update;
    if v_job.spots_taken >= v_job.slots then
      raise exception 'All spots for this job are already filled';
    end if;
    update public.jobs
    set spots_taken = spots_taken + 1,
        status = case when spots_taken + 1 >= slots then 'closed' else status end
    where id = v_job.id;
  end if;

  update public.applications
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decision_note = nullif(btrim(p_note), ''),
      decided_at = now(),
      decided_by = auth.uid()
  where id = p_application_id;
end;
$$;

-- Talent: submit proof of work for an accepted application.
create function public.submit_work(
  p_application_id uuid,
  p_notes text,
  p_links text[],
  p_file_paths text[],
  p_units_claimed integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_job public.jobs%rowtype;
  v_links text[] := coalesce(p_links, '{}');
  v_files text[] := coalesce(p_file_paths, '{}');
  v_item text;
  v_id uuid;
begin
  select * into v_app from public.applications
  where id = p_application_id and user_id = v_uid
  for update;
  if not found or v_app.status <> 'accepted' then
    raise exception 'You can only submit work for jobs you were accepted for';
  end if;
  select * into v_job from public.jobs where id = v_app.job_id;

  if exists (select 1 from public.submissions where application_id = v_app.id and status = 'submitted') then
    raise exception 'Your work is already waiting for review';
  end if;
  if exists (select 1 from public.submissions where application_id = v_app.id and status in ('approved', 'rejected')) then
    raise exception 'This job has already been reviewed';
  end if;

  if cardinality(v_links) = 0 and cardinality(v_files) = 0 then
    raise exception 'Add at least one link or file as proof';
  end if;
  if cardinality(v_links) > 20 or cardinality(v_files) > 10 then
    raise exception 'Too many links or files';
  end if;
  foreach v_item in array v_links loop
    if v_item !~ '^https?://\S+$' or char_length(v_item) > 500 then
      raise exception 'Links must be full URLs starting with https://';
    end if;
  end loop;
  -- Files must be ones this user uploaded for this application.
  foreach v_item in array v_files loop
    if v_item not like v_uid::text || '/' || v_app.id::text || '/%' then
      raise exception 'Invalid file';
    end if;
  end loop;

  if v_job.pay_type = 'per_unit' then
    if p_units_claimed is null or p_units_claimed < 1 then
      raise exception 'Enter how many units you completed (1 unit = 1 %)', v_job.unit_label;
    end if;
  elsif p_units_claimed is not null then
    raise exception 'Units only apply to per-unit jobs';
  end if;

  insert into public.submissions (application_id, user_id, notes, links, file_paths, units_claimed)
  values (v_app.id, v_uid, nullif(btrim(p_notes), ''), v_links, v_files, p_units_claimed)
  returning id into v_id;
  return v_id;
end;
$$;

-- Admin: review a submission. Approval creates the owed payout atomically.
create function public.review_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text default null,
  p_units_approved integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub public.submissions%rowtype;
  v_job public.jobs%rowtype;
  v_note text := nullif(btrim(p_note), '');
  v_units integer;
  v_amount integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review submissions';
  end if;
  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Unknown decision';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or v_sub.status <> 'submitted' then
    raise exception 'This submission has already been reviewed';
  end if;
  if p_decision <> 'approved' and v_note is null then
    raise exception 'Add a note explaining what to change or why it was rejected';
  end if;

  if p_decision = 'approved' then
    select j.* into v_job
    from public.jobs j join public.applications a on a.job_id = j.id
    where a.id = v_sub.application_id;

    if v_job.pay_type = 'per_unit' then
      v_units := coalesce(p_units_approved, v_sub.units_claimed);
      if v_units is null or v_units < 1 then
        raise exception 'Approved units must be at least 1';
      end if;
      v_units := least(v_units, v_job.max_units);
      v_amount := v_job.pay_cents * v_units;
    else
      v_amount := v_job.pay_cents;
    end if;

    insert into public.payouts (user_id, submission_id, amount_cents)
    values (v_sub.user_id, v_sub.id, v_amount);
  end if;

  update public.submissions
  set status = p_decision,
      reviewer_note = v_note,
      units_approved = v_units,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_submission_id;
end;
$$;

-- Admin: mark owed payouts as paid after sending the money.
create function public.mark_payouts_paid(
  p_payout_ids uuid[],
  p_method text,
  p_reference text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can mark payouts as paid';
  end if;
  if p_method not in ('bank', 'juice', 'wise', 'paypal', 'other') then
    raise exception 'Choose how the money was sent';
  end if;

  update public.payouts
  set status = 'paid',
      method = p_method,
      reference = nullif(btrim(p_reference), ''),
      paid_at = now(),
      paid_by = auth.uid()
  where id = any (p_payout_ids) and status = 'owed';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.apply_to_job(uuid, text),
  public.withdraw_application(uuid),
  public.decide_application(uuid, boolean, text),
  public.submit_work(uuid, text, text[], text[], integer),
  public.review_submission(uuid, text, text, integer),
  public.mark_payouts_paid(uuid[], text, text)
from public, anon;

grant execute on function
  public.apply_to_job(uuid, text),
  public.withdraw_application(uuid),
  public.decide_application(uuid, boolean, text),
  public.submit_work(uuid, text, text[], text[], integer),
  public.review_submission(uuid, text, text, integer),
  public.mark_payouts_paid(uuid[], text, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- submissions bucket: private. Talent upload to <user id>/<application id>/,
-- read their own files; admins read everything.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions', 'submissions', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

create policy "Users upload submission files to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.applications a
    where a.id::text = (storage.foldername(name))[2]
      and a.user_id = (select auth.uid())
      and a.status = 'accepted'
  )
);

create policy "Users read own submission files, admins read all"
on storage.objects for select to authenticated
using (
  bucket_id = 'submissions'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);
