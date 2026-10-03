-- Phase 8: staged-reveal + direct-pay via Juice QR.
--  * Watermarked previews live in a separate bucket the company CAN read.
--  * Clean files stay in the owner/admin-only 'submissions' bucket; the app signs
--    them for the company only after the talent confirms payment (service role).
--  * The talent confirms receipt, which marks the payout paid and unlocks files.

alter table public.submissions
  add column preview_paths text[] not null default '{}',
  add column payment_confirmed_by_talent boolean not null default false,
  add column payment_confirmed_at timestamptz;

-- Watermarked previews: owner + admin + the job's company owner may read. Writes
-- happen server-side with the service role (which bypasses RLS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submission-previews', 'submission-previews', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

create policy "Read submission previews: owner, company, admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'submission-previews'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
    or exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
      where a.id::text = (storage.foldername(name))[2] and c.owner_id = (select auth.uid())
    )
  )
);

-- ---------------------------------------------------------------------------
-- Talent confirms they received the Juice payment: marks the payout paid and
-- records the confirmation (which unlocks the clean files for the company).
-- ---------------------------------------------------------------------------
create function public.confirm_payment_received(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
begin
  select * into v_sub from public.submissions where id = p_submission_id for update;
  if not found then
    raise exception 'Submission not found';
  end if;
  if v_sub.user_id <> v_uid then
    raise exception 'Only the freelancer can confirm payment';
  end if;
  if v_sub.status <> 'approved' then
    raise exception 'You can confirm payment once the work is approved';
  end if;
  if v_sub.payment_confirmed_by_talent then
    return; -- already confirmed; idempotent
  end if;

  update public.submissions
  set payment_confirmed_by_talent = true, payment_confirmed_at = now()
  where id = p_submission_id;

  update public.payouts
  set status = 'paid', method = coalesce(method, 'juice'), paid_at = now()
  where submission_id = p_submission_id and status = 'owed';
end;
$$;

revoke execute on function public.confirm_payment_received(uuid) from public, anon;
grant execute on function public.confirm_payment_received(uuid) to authenticated;
