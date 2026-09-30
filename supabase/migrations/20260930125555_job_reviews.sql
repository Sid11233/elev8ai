-- Phase H: feedback + ratings once a payout is paid.
--   * Both parties can leave private feedback to the admin (comment only).
--   * The provider additionally gives the freelancer a 1-5 star rating.
--   * One review per party per accepted application.
--   * Raw feedback is readable only by its author and admins. Companies see a
--     freelancer's aggregate rating (via a function), never the comments.

create table public.job_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  author_role text not null check (author_role in ('provider', 'freelancer')),
  -- The freelancer being rated (set on provider reviews only).
  subject_user_id uuid references auth.users (id) on delete set null,
  stars smallint check (stars between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (application_id, author_id)
);
create index job_reviews_subject_idx on public.job_reviews (subject_user_id) where stars is not null;

alter table public.job_reviews enable row level security;
revoke all on public.job_reviews from anon, authenticated;
grant select on public.job_reviews to authenticated;

-- Only the author or an admin can read a review (keeps comments private).
create policy "Authors read own reviews, admins all"
on public.job_reviews for select to authenticated
using (author_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- A paid payout exists for the application (the trigger for reviews).
-- ---------------------------------------------------------------------------
create function public.application_is_paid(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.payouts p
    join public.submissions s on s.id = p.submission_id
    where s.application_id = p_application_id and p.status = 'paid'
  );
$$;

-- ---------------------------------------------------------------------------
-- Submit a review. Role is derived from the caller: the applicant is the
-- freelancer; whoever manages the job is the provider. Requires a paid payout
-- and enforces one review per party.
-- ---------------------------------------------------------------------------
create function public.submit_job_review(
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
  v_subject uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please log in';
  end if;
  select * into v_app from public.applications where id = p_application_id;
  if not found then
    raise exception 'Job not found';
  end if;

  if v_app.user_id = v_uid then
    v_role := 'freelancer';
    v_stars := null; -- freelancers don't rate, they only leave feedback
    v_subject := null;
  elsif public.manages_job(v_app.job_id) then
    v_role := 'provider';
    v_subject := v_app.user_id;
    if v_stars is null or v_stars < 1 or v_stars > 5 then
      raise exception 'Give a star rating from 1 to 5';
    end if;
  else
    raise exception 'You can''t review this job';
  end if;

  if not public.application_is_paid(p_application_id) then
    raise exception 'You can leave feedback once the payout is paid';
  end if;
  if v_role = 'freelancer' and v_comment is null then
    raise exception 'Write a few words of feedback';
  end if;

  insert into public.job_reviews
    (application_id, job_id, author_id, author_role, subject_user_id, stars, comment)
  values
    (p_application_id, v_app.job_id, v_uid, v_role, v_subject, v_stars, v_comment)
  on conflict (application_id, author_id) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'You have already left feedback for this job';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aggregate freelancer ratings, so companies can see a rating without reading
-- the private comments. Returns average + count per user.
-- ---------------------------------------------------------------------------
create function public.freelancer_ratings(p_user_ids uuid[])
returns table (user_id uuid, avg_stars numeric, rating_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select subject_user_id, round(avg(stars), 1), count(*)
  from public.job_reviews
  where stars is not null and subject_user_id = any(p_user_ids)
  group by subject_user_id;
$$;

revoke execute on function public.submit_job_review(uuid, smallint, text) from public, anon;
grant execute on function public.submit_job_review(uuid, smallint, text) to authenticated;
revoke execute on function public.freelancer_ratings(uuid[]) from public, anon;
grant execute on function public.freelancer_ratings(uuid[]) to authenticated;
revoke execute on function public.application_is_paid(uuid) from public, anon;
grant execute on function public.application_is_paid(uuid) to authenticated;
