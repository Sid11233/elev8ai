-- Phase 8: lockedinnn-hosted payment page. A payment_requests row is created when
-- a submission is approved (i.e. when its payout is created). The secure token is
-- the row id; a public page /p/<username>/<token> renders the pay details.

create table public.payment_requests (
  id text primary key, -- the secure, cryptographically-random token
  application_id uuid not null references public.applications (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  reference_code text not null check (char_length(reference_code) <= 40),
  status text not null default 'pending' check (status in ('pending', 'viewed', 'confirmed', 'expired')),
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  viewed_at timestamptz
);
create unique index payment_requests_application_idx on public.payment_requests (application_id);

alter table public.payment_requests enable row level security;
revoke all on public.payment_requests from anon, authenticated;
-- Readable by the talent who owns the application, the job's company owner, and
-- admins. Writes happen server-side only (service role); the public page also
-- reads via the service role, not through RLS.
grant select on public.payment_requests to authenticated;

create policy "Read own/own-job payment requests, admins all"
on public.payment_requests for select to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1 from public.applications a
    where a.id = payment_requests.application_id and a.user_id = (select auth.uid())
  )
  or (select public.owns_job((select job_id from public.applications where id = payment_requests.application_id)))
);

-- A payout is created exactly when a submission is approved, for both admin and
-- company review paths — so a trigger here covers approval without touching the
-- Phase 3 review_submission function.
create function public.create_payment_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
  v_job_id uuid;
  v_ref text;
  v_token text;
begin
  select a.id, a.job_id into v_application_id, v_job_id
  from public.submissions s
  join public.applications a on a.id = s.application_id
  where s.id = new.submission_id;
  if v_application_id is null then
    return new;
  end if;

  -- One payment request per application (payout is unique per submission, and a
  -- submission maps to one application).
  if exists (select 1 from public.payment_requests where application_id = v_application_id) then
    return new;
  end if;

  -- 32-char crypto-random token from gen_random_uuid (pg_catalog, 128-bit).
  v_token := replace(gen_random_uuid()::text, '-', '');
  -- Short human-typeable reference derived deterministically from the job id.
  v_ref := 'JOB-' || lpad(
    (abs(('x' || substr(md5(v_job_id::text), 1, 8))::bit(32)::int) % 10000)::text, 4, '0');

  insert into public.payment_requests (id, application_id, amount_cents, reference_code)
  values (v_token, v_application_id, new.amount_cents, v_ref);
  return new;
end;
$$;

create trigger payouts_create_payment_request
after insert on public.payouts
for each row execute function public.create_payment_request();

-- Extend the talent's confirm-receipt action to also flip the payment_requests
-- row to 'confirmed' in the same transaction that marks the payout paid and
-- unlocks the clean files.
create or replace function public.confirm_payment_received(p_submission_id uuid)
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

  update public.payment_requests
  set status = 'confirmed'
  where application_id = v_sub.application_id and status <> 'confirmed';
end;
$$;
