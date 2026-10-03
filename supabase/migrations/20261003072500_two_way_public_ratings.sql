-- Phase 9: two-way public ratings. Replaces the earlier one-way (provider->talent
-- stars + private admin feedback) model. Now both sides rate 1-5 + an optional
-- comment after a paid job, and reviews are public (shown on profiles).

-- Freelancer->company reviews rate the company entity, not a user.
alter table public.job_reviews
  add column subject_company_id uuid references public.companies (id) on delete set null;
create index job_reviews_subject_company_idx
  on public.job_reviews (subject_company_id) where stars is not null;

-- Reviews are now public: any signed-in user can read them (profiles show them).
drop policy if exists "Authors read own reviews, admins all" on public.job_reviews;
create policy "Signed-in read reviews"
on public.job_reviews for select to authenticated using (true);

-- Rewrite submit_job_review: both roles give a 1-5 rating + optional comment.
create or replace function public.submit_job_review(
  p_application_id uuid,
  p_stars smallint default null,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications%rowtype;
  v_role text;
  v_comment text := nullif(btrim(p_comment), '');
  v_stars smallint := p_stars;
  v_subject_user uuid;
  v_subject_company uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please log in';
  end if;
  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Job not found';
  end if;

  if v_stars is null or v_stars < 1 or v_stars > 5 then
    raise exception 'Give a star rating from 1 to 5';
  end if;

  if v_app.user_id = v_uid then
    v_role := 'freelancer';
    -- Freelancer rates the company that posted the job.
    select j.company_id into v_subject_company
    from public.jobs j where j.id = v_app.job_id;
  elsif public.manages_job(v_app.job_id) then
    v_role := 'provider';
    v_subject_user := v_app.user_id; -- provider rates the freelancer
  else
    raise exception 'You can''t review this job';
  end if;

  if not public.application_is_paid(p_application_id) then
    raise exception 'You can leave a review once the payout is paid';
  end if;

  insert into public.job_reviews
    (application_id, job_id, author_id, author_role, subject_user_id, subject_company_id, stars, comment)
  values
    (p_application_id, v_app.job_id, v_uid, v_role, v_subject_user, v_subject_company, v_stars, v_comment)
  on conflict (application_id, author_id) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'You have already reviewed this job';
  end if;
  return v_id;
end;
$$;

-- Aggregate company ratings (parallel to freelancer_ratings).
create function public.company_ratings(p_company_ids uuid[])
returns table (company_id uuid, avg_stars numeric, rating_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select subject_company_id, round(avg(stars), 1), count(*)
  from public.job_reviews
  where stars is not null and subject_company_id = any(p_company_ids)
  group by subject_company_id;
$$;

revoke execute on function public.company_ratings(uuid[]) from public, anon;
grant execute on function public.company_ratings(uuid[]) to authenticated;
