-- Phase F: let a company apply to another company's job. Companies are exempt
-- from skill badges, so apply_to_job skips the badge requirement for a caller
-- who owns a company. Everything else (open, deadline, spots, duplicates,
-- links/files validation) still applies.

create or replace function public.apply_to_job(
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
  v_is_company boolean := exists (select 1 from public.companies where owner_id = v_uid);
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
  -- A company can't apply to its own job.
  if v_is_company and exists (
    select 1 from public.companies where owner_id = v_uid and id = v_job.company_id
  ) then
    raise exception 'You can''t apply to your own job';
  end if;
  if v_job.spots_taken >= v_job.slots then
    raise exception 'All spots for this job are taken';
  end if;
  -- Companies are exempt from skill badges; talent still needs the badge.
  if not v_is_company and v_job.required_skill_id is not null and not exists (
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
