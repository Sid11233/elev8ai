-- Security hardening (vibe-security audit). Additive — no existing behavior for
-- legitimate callers changes; this closes gaps an attacker could otherwise use.

-- ---------------------------------------------------------------------------
-- 1. companies: RLS only scopes rows ("your own company"), not columns. A
--    company owner could directly UPDATE verification_tier or
--    storage_quota_bytes on their own row via the REST API, bypassing the
--    new-company job-value cap and the storage quota — both built specifically
--    as anti-fraud guardrails. Enforce column immutability for non-admins with
--    a BEFORE UPDATE trigger (OLD vs NEW comparison, unambiguous — unlike a
--    self-referencing RLS WITH CHECK subquery).
-- ---------------------------------------------------------------------------
create function public.protect_company_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new; -- admins (and admin-invoked RPCs like set_company_tier) may change anything
  end if;
  if new.verification_tier is distinct from old.verification_tier then
    raise exception 'Only an admin can change a company''s verification tier';
  end if;
  if new.storage_quota_bytes is distinct from old.storage_quota_bytes then
    raise exception 'Only an admin can change a company''s storage quota';
  end if;
  return new;
end;
$$;

create trigger companies_protect_admin_fields
before update on public.companies
for each row execute function public.protect_company_admin_fields();

-- ---------------------------------------------------------------------------
-- 2. jobs: the "Managers update jobs" policy checks manages_job(id), which
--    re-queries the row by its (immutable) primary key — it doesn't directly
--    validate the NEW company_id the way the INSERT policy does. Close the gap
--    explicitly: a non-admin can't reassign a job to a different company.
-- ---------------------------------------------------------------------------
create function public.protect_job_company_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.company_id is distinct from old.company_id then
    raise exception 'A job can''t be reassigned to a different company';
  end if;
  return new;
end;
$$;

create trigger jobs_protect_company_id
before update on public.jobs
for each row execute function public.protect_job_company_id();

-- ---------------------------------------------------------------------------
-- 3. SECURITY DEFINER functions without an explicit REVOKE/GRANT rely on
--    Postgres's default behavior of granting EXECUTE to PUBLIC (and therefore
--    the anon role) on function creation. Every function below already
--    enforces its own authorization internally (auth.uid()/is_admin() checks,
--    or is a trigger function inert outside trigger context), so this is a
--    defense-in-depth/consistency fix, not a live bypass — but it closes an
--    unauthenticated probing surface and matches the rest of the codebase's
--    convention of locking these down explicitly.
-- ---------------------------------------------------------------------------
revoke execute on function public.can_access_conversation_folder(text) from public, anon;
grant execute on function public.can_access_conversation_folder(text) to authenticated;

revoke execute on function public.decide_application(uuid, boolean, text) from public, anon;
grant execute on function public.decide_application(uuid, boolean, text) to authenticated;

revoke execute on function public.get_course_syllabus(uuid) from public, anon;
grant execute on function public.get_course_syllabus(uuid) to authenticated;

revoke execute on function public.grade_assignment(uuid, boolean, text) from public, anon;
grant execute on function public.grade_assignment(uuid, boolean, text) to authenticated;

revoke execute on function public.has_product_access(uuid) from public, anon;
grant execute on function public.has_product_access(uuid) to authenticated;

revoke execute on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

revoke execute on function public.is_my_applicant(uuid) from public, anon;
grant execute on function public.is_my_applicant(uuid) to authenticated;

revoke execute on function public.manages_job(uuid) from public, anon;
grant execute on function public.manages_job(uuid) to authenticated;

revoke execute on function public.mark_payouts_paid(uuid[], text, text) from public, anon;
grant execute on function public.mark_payouts_paid(uuid[], text, text) to authenticated;

revoke execute on function public.review_course_purchase(uuid, boolean, text) from public, anon;
grant execute on function public.review_course_purchase(uuid, boolean, text) to authenticated;

revoke execute on function public.review_submission(uuid, text, text, integer) from public, anon;
grant execute on function public.review_submission(uuid, text, text, integer) to authenticated;

revoke execute on function public.submit_work(uuid, text, text[], text[], integer) from public, anon;
grant execute on function public.submit_work(uuid, text, text[], text[], integer) to authenticated;

revoke execute on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.withdraw_application(uuid) to authenticated;

revoke execute on function public.list_conversations() from public, anon;
grant execute on function public.list_conversations() to authenticated;

-- Trigger functions: not meaningfully callable outside trigger context (they
-- reference NEW/OLD), but lock them down too for hygiene and to prevent anon
-- from even attempting the call.
revoke execute on function public.enforce_new_company_job_cap() from public, anon, authenticated;
revoke execute on function public.set_job_proof_type() from public, anon, authenticated;
revoke execute on function public.create_payment_request() from public, anon, authenticated;
revoke execute on function public.issue_platform_certificate() from public, anon, authenticated;
revoke execute on function public.set_application_consent() from public, anon, authenticated;
revoke execute on function public.snapshot_brief_on_acceptance() from public, anon, authenticated;
revoke execute on function public.version_brief_on_edit() from public, anon, authenticated;
revoke execute on function public.protect_company_admin_fields() from public, anon, authenticated;
revoke execute on function public.protect_job_company_id() from public, anon, authenticated;
