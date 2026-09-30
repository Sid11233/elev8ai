-- Phase A: let applicants attach links and files to a job application, so they
-- can make themselves appealing to the job provider.

alter table public.applications
  add column links text[] not null default '{}',
  add column file_paths text[] not null default '{}';

-- Private bucket for application attachments, scoped to the applicant's folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-attachments', 'application-attachments', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

create policy "Users upload own application attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'application-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Users read own application attachments, admins all"
on storage.objects for select to authenticated
using (
  bucket_id = 'application-attachments'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);

-- Replace apply_to_job with a version that also stores links and files.
drop function if exists public.apply_to_job(uuid, text);

create function public.apply_to_job(
  p_job_id uuid,
  p_pitch text default null,
  p_links text[] default '{}',
  p_file_paths text[] default '{}'
)
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
  v_links text[] := coalesce(p_links, '{}');
  v_files text[] := coalesce(p_file_paths, '{}');
  v_item text;
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

  if cardinality(v_links) > 10 or cardinality(v_files) > 10 then
    raise exception 'Too many links or files';
  end if;
  foreach v_item in array v_links loop
    if v_item !~ '^https?://\S+$' or char_length(v_item) > 500 then
      raise exception 'Links must be full URLs starting with https://';
    end if;
  end loop;
  foreach v_item in array v_files loop
    if v_item not like v_uid::text || '/' || p_job_id::text || '/%' then
      raise exception 'Invalid file';
    end if;
  end loop;

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
    set status = 'pending', pitch = v_pitch, links = v_links, file_paths = v_files,
        decision_note = null, decided_at = null, decided_by = null
    where id = v_existing.id;
    return v_existing.id;
  end if;

  insert into public.applications (job_id, user_id, pitch, links, file_paths)
  values (p_job_id, v_uid, v_pitch, v_links, v_files)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.apply_to_job(uuid, text, text[], text[]) from public, anon;
grant execute on function public.apply_to_job(uuid, text, text[], text[]) to authenticated;
