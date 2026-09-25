-- Phase 6: course assignments + grading (awards badges), payout details.

alter table public.courses
  add column assignment_brief text check (char_length(assignment_brief) <= 5000);

-- ---------------------------------------------------------------------------
-- course_assignments: one attempt per submission; graded by admin.
-- ---------------------------------------------------------------------------
create table public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  notes text check (char_length(notes) <= 2000),
  links text[] not null default '{}',
  file_paths text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'passed', 'failed')),
  feedback text check (char_length(feedback) <= 2000),
  graded_by uuid references auth.users (id) on delete set null,
  graded_at timestamptz,
  created_at timestamptz not null default now()
);

create index course_assignments_user_idx on public.course_assignments (user_id);
create index course_assignments_status_idx on public.course_assignments (status);
-- One pending attempt per user+course.
create unique index course_assignments_one_pending_idx
  on public.course_assignments (user_id, course_id) where status = 'pending';

alter table public.course_assignments enable row level security;
revoke all on public.course_assignments from anon, authenticated;
grant select on public.course_assignments to authenticated;

create policy "Users read own assignments, admins all"
on public.course_assignments for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- payout_details: sensitive. Readable only by the owner and admins.
-- ---------------------------------------------------------------------------
create table public.payout_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  method text not null check (method in ('bank', 'juice', 'wise', 'paypal')),
  details jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.payout_details enable row level security;
revoke all on public.payout_details from anon, authenticated;
grant select, insert, update on public.payout_details to authenticated;

create policy "Owner and admins read payout details"
on public.payout_details for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Owner writes own payout details"
on public.payout_details for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Owner updates own payout details"
on public.payout_details for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create trigger payout_details_set_updated_at
before update on public.payout_details
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Talent submits (or resubmits after a fail) a course assignment.
create function public.submit_assignment(
  p_course_id uuid,
  p_notes text,
  p_links text[],
  p_file_paths text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_links text[] := coalesce(p_links, '{}');
  v_files text[] := coalesce(p_file_paths, '{}');
  v_item text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please log in';
  end if;
  if not public.has_course_access(p_course_id) then
    raise exception 'Buy the course before submitting its assignment';
  end if;
  if exists (
    select 1 from public.course_assignments
    where user_id = v_uid and course_id = p_course_id and status = 'pending'
  ) then
    raise exception 'Your assignment is already waiting to be graded';
  end if;
  if exists (
    select 1 from public.course_assignments
    where user_id = v_uid and course_id = p_course_id and status = 'passed'
  ) then
    raise exception 'You have already passed this assignment';
  end if;

  if cardinality(v_links) = 0 and cardinality(v_files) = 0 then
    raise exception 'Add at least one link or file';
  end if;
  if cardinality(v_links) > 20 or cardinality(v_files) > 10 then
    raise exception 'Too many links or files';
  end if;
  foreach v_item in array v_links loop
    if v_item !~ '^https?://\S+$' or char_length(v_item) > 500 then
      raise exception 'Links must be full URLs starting with https://';
    end if;
  end loop;
  foreach v_item in array v_files loop
    if v_item not like v_uid::text || '/' || p_course_id::text || '/%' then
      raise exception 'Invalid file';
    end if;
  end loop;

  insert into public.course_assignments (user_id, course_id, notes, links, file_paths)
  values (v_uid, p_course_id, nullif(btrim(p_notes), ''), v_links, v_files)
  returning id into v_id;
  return v_id;
end;
$$;

-- Admin grades an assignment. Passing awards the course's skill (badge) in the
-- same transaction. Returns the awarded skill id (or null).
create function public.grade_assignment(
  p_assignment_id uuid,
  p_pass boolean,
  p_feedback text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asg public.course_assignments%rowtype;
  v_skill_id uuid;
  v_feedback text := nullif(btrim(p_feedback), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can grade assignments';
  end if;

  select * into v_asg from public.course_assignments where id = p_assignment_id for update;
  if not found or v_asg.status <> 'pending' then
    raise exception 'This assignment has already been graded';
  end if;
  if not p_pass and v_feedback is null then
    raise exception 'Add feedback explaining what to improve';
  end if;

  update public.course_assignments
  set status = case when p_pass then 'passed' else 'failed' end,
      feedback = v_feedback,
      graded_by = auth.uid(),
      graded_at = now()
  where id = p_assignment_id;

  if p_pass then
    select skill_id into v_skill_id from public.courses where id = v_asg.course_id;
    if v_skill_id is not null then
      insert into public.user_skills (user_id, skill_id, source, awarded_by)
      values (v_asg.user_id, v_skill_id, 'course', auth.uid())
      on conflict (user_id, skill_id) do nothing;
    end if;
  end if;
  return v_skill_id;
end;
$$;

revoke execute on function
  public.submit_assignment(uuid, text, text[], text[]),
  public.grade_assignment(uuid, boolean, text)
from public, anon;
grant execute on function
  public.submit_assignment(uuid, text, text[], text[]),
  public.grade_assignment(uuid, boolean, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- assignment-files bucket: private, scoped to <user id>/<course id>/.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-files', 'assignment-files', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

create policy "Users upload assignment files to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.has_course_access(((storage.foldername(name))[2])::uuid))
);

create policy "Users read own assignment files, admins all"
on storage.objects for select to authenticated
using (
  bucket_id = 'assignment-files'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);
