-- Phase E: let a company manage its own jobs and everything hanging off them.
-- Management = admin OR the company that owns the job. Freelancers unaffected.

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer so they don't recurse through RLS)
-- ---------------------------------------------------------------------------
create function public.owns_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = p_job_id and c.owner_id = (select auth.uid())
  );
$$;

create function public.manages_job(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.owns_job(p_job_id);
$$;

-- Did p_user_id apply to a job owned by the current user? Lets a company read
-- an applicant's profile and badges.
create function public.is_my_applicant(p_user_id uuid)
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
    where a.user_id = p_user_id and c.owner_id = (select auth.uid())
  );
$$;

grant execute on function public.owns_job(uuid), public.manages_job(uuid), public.is_my_applicant(uuid)
  to authenticated;
revoke execute on function public.owns_job(uuid), public.manages_job(uuid), public.is_my_applicant(uuid)
  from public, anon;

-- ---------------------------------------------------------------------------
-- jobs: companies see and manage their own; everyone still sees open jobs.
-- ---------------------------------------------------------------------------
drop policy "Users read open jobs and jobs they applied to, admins read all" on public.jobs;
drop policy "Admins manage jobs" on public.jobs;

create policy "Read open jobs, own company jobs, applied jobs; admins all"
on public.jobs for select to authenticated
using (
  status = 'open'
  or (select public.is_admin())
  or company_id in (select id from public.companies where owner_id = (select auth.uid()))
  or exists (
    select 1 from public.applications a where a.job_id = jobs.id and a.user_id = (select auth.uid())
  )
);

create policy "Managers insert jobs"
on public.jobs for insert to authenticated
with check (
  (select public.is_admin())
  or company_id in (select id from public.companies where owner_id = (select auth.uid()))
);
create policy "Managers update jobs"
on public.jobs for update to authenticated
using ((select public.manages_job(id)))
with check ((select public.manages_job(id)));
create policy "Managers delete jobs"
on public.jobs for delete to authenticated
using ((select public.manages_job(id)));

-- ---------------------------------------------------------------------------
-- applications / submissions / payouts: add the job's company as a reader.
-- ---------------------------------------------------------------------------
drop policy "Users read own applications, admins read all" on public.applications;
create policy "Read own applications, own-job applications, admins all"
on public.applications for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (select public.owns_job(job_id))
);

drop policy "Users read own submissions, admins read all" on public.submissions;
create policy "Read own submissions, own-job submissions, admins all"
on public.submissions for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (select public.owns_job((select a.job_id from public.applications a where a.id = submissions.application_id)))
);

drop policy "Users read own payouts, admins read all" on public.payouts;
create policy "Read own payouts, own-job payouts, admins all"
on public.payouts for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (select public.owns_job((
    select a.job_id from public.applications a
    join public.submissions s on s.application_id = a.id
    where s.id = payouts.submission_id
  )))
);

-- ---------------------------------------------------------------------------
-- profiles / user_skills: a company can read the profile + badges of anyone
-- who applied to one of its jobs.
-- ---------------------------------------------------------------------------
drop policy "Users read own profile, admins read all" on public.profiles;
create policy "Read own profile, applicants, admins all"
on public.profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (select public.is_my_applicant(user_id))
);

drop policy "Users read own badges, admins read all" on public.user_skills;
create policy "Read own badges, applicants, admins all"
on public.user_skills for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_admin())
  or (select public.is_my_applicant(user_id))
);

-- ---------------------------------------------------------------------------
-- conversations: the job's company owner is a participant too.
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1
    from public.conversations c
    join public.applications a on a.id = c.application_id
    where c.id = p_conversation_id
      and (
        a.user_id = (select auth.uid())
        or exists (
          select 1 from public.jobs j
          join public.companies co on co.id = j.company_id
          where j.id = a.job_id and co.owner_id = (select auth.uid())
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Workflow functions: admin OR the job's company owner may act.
-- ---------------------------------------------------------------------------
create or replace function public.decide_application(
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
  select * into v_app from public.applications where id = p_application_id for update;
  if not found or v_app.status <> 'pending' then
    raise exception 'This application has already been decided';
  end if;
  if not public.manages_job(v_app.job_id) then
    raise exception 'You can''t review this application';
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

    insert into public.conversations (application_id)
    values (p_application_id)
    on conflict (application_id) do nothing;
  end if;

  update public.applications
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decision_note = nullif(btrim(p_note), ''),
      decided_at = now(),
      decided_by = auth.uid()
  where id = p_application_id;
end;
$$;

create or replace function public.review_submission(
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
  v_job_id uuid;
begin
  if p_decision not in ('approved', 'changes_requested', 'rejected') then
    raise exception 'Unknown decision';
  end if;

  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found or v_sub.status <> 'submitted' then
    raise exception 'This submission has already been reviewed';
  end if;

  select a.job_id into v_job_id from public.applications a where a.id = v_sub.application_id;
  if not public.manages_job(v_job_id) then
    raise exception 'You can''t review this submission';
  end if;
  if p_decision <> 'approved' and v_note is null then
    raise exception 'Add a note explaining what to change or why it was rejected';
  end if;

  if p_decision = 'approved' then
    select * into v_job from public.jobs where id = v_job_id;
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

create or replace function public.mark_payouts_paid(
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
  if p_method not in ('bank', 'juice', 'wise', 'paypal', 'other') then
    raise exception 'Choose how the money was sent';
  end if;

  -- Only pay out payouts on jobs the caller manages (admin or the job's company).
  update public.payouts p
  set status = 'paid',
      method = p_method,
      reference = nullif(btrim(p_reference), ''),
      paid_at = now(),
      paid_by = auth.uid()
  where p.id = any (p_payout_ids)
    and p.status = 'owed'
    and public.manages_job((
      select a.job_id from public.applications a
      join public.submissions s on s.application_id = a.id
      where s.id = p.submission_id
    ));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
