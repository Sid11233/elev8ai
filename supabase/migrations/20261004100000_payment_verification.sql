-- Build plan (2): evidence-based payment verification. Company reports the Juice
-- transfer with a transaction id + proof; talent confirms or disputes; silence
-- never releases the file. Additive — Phases 0-7 untouched.

-- ---------------------------------------------------------------------------
-- payment_requests: verification columns + wider status set.
-- ---------------------------------------------------------------------------
alter table public.payment_requests drop constraint if exists payment_requests_status_check;
alter table public.payment_requests
  add constraint payment_requests_status_check
  check (status in ('pending', 'viewed', 'payment_reported', 'awaiting_statement', 'settled', 'failed', 'expired'));

alter table public.payment_requests
  add column company_txn_id text unique,
  add column company_proof_path text,
  add column company_proof_hash text,
  add column company_marked_paid_at timestamptz,
  add column talent_response text check (talent_response in ('confirmed', 'disputed')),
  add column talent_txn_id_entered text,
  add column talent_responded_at timestamptz,
  add column statement_path text,
  add column resolution text check (resolution in ('settled', 'proven', 'failed')),
  add column resolved_by uuid references auth.users (id) on delete set null,
  add column resolved_at timestamptz;

create unique index payment_requests_proof_hash_idx
  on public.payment_requests (company_proof_hash) where company_proof_hash is not null;

-- ---------------------------------------------------------------------------
-- payment_events: append-only audit log.
-- ---------------------------------------------------------------------------
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_request_id text references public.payment_requests (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null check (char_length(event_type) <= 50),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index payment_events_request_idx on public.payment_events (payment_request_id, created_at);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
-- Admins read the log; writes are server-side (service role). No update/delete
-- grants or policies, so the log is append-only.
grant select on public.payment_events to authenticated;
create policy "Admins read payment events"
on public.payment_events for select to authenticated
using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- user_strikes: hidden per-user counter of lost disputes / abuse.
-- ---------------------------------------------------------------------------
create table public.user_strikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  payment_request_id text references public.payment_requests (id) on delete set null,
  created_at timestamptz not null default now()
);
create index user_strikes_user_idx on public.user_strikes (user_id);

alter table public.user_strikes enable row level security;
revoke all on public.user_strikes from anon, authenticated;
grant select on public.user_strikes to authenticated;
create policy "Admins read strikes"
on public.user_strikes for select to authenticated
using ((select public.is_admin()));

-- profiles.suspended: set when strikes cross the threshold.
alter table public.profiles
  add column suspended boolean not null default false;

-- ---------------------------------------------------------------------------
-- Rework confirm_payment_received: a talent can only confirm AFTER the company
-- has reported payment. Confirm settles + unlocks; it never fires on silence.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment_received(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
  v_pr public.payment_requests%rowtype;
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
    return; -- idempotent
  end if;

  select * into v_pr from public.payment_requests
  where application_id = v_sub.application_id for update;
  if v_pr.company_marked_paid_at is null then
    raise exception 'Wait until the company reports the payment, then confirm you received it';
  end if;

  update public.submissions
  set payment_confirmed_by_talent = true, payment_confirmed_at = now()
  where id = p_submission_id;

  update public.payouts
  set status = 'paid', method = coalesce(method, 'juice'), paid_at = now()
  where submission_id = p_submission_id and status = 'owed';

  update public.payment_requests
  set status = 'settled', resolution = 'settled',
      talent_response = 'confirmed', talent_responded_at = now(),
      resolved_at = now()
  where id = v_pr.id;

  insert into public.payment_events (payment_request_id, actor_id, event_type, payload)
  values (v_pr.id, v_uid, 'talent_confirmed', '{}');
end;
$$;

-- Strike threshold: suspend a user at this many strikes.
-- ---------------------------------------------------------------------------
-- Company (or admin) reports the Juice transfer with a transaction id + proof.
-- ---------------------------------------------------------------------------
create function public.report_payment(
  p_submission_id uuid,
  p_txn_id text,
  p_proof_path text default null,
  p_proof_hash text default null,
  p_amount_cents integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
  v_pr public.payment_requests%rowtype;
  v_txn text := nullif(btrim(p_txn_id), '');
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found';
  end if;
  if not public.manages_job((select job_id from public.applications where id = v_sub.application_id)) then
    raise exception 'You can''t report payment for this job';
  end if;
  if v_txn is null then
    raise exception 'Enter the Juice transaction id';
  end if;

  select * into v_pr from public.payment_requests
  where application_id = v_sub.application_id for update;
  if not found then
    raise exception 'No payment request for this job yet';
  end if;
  if v_pr.resolution is not null then
    raise exception 'This payment is already resolved';
  end if;

  begin
    update public.payment_requests
    set company_txn_id = v_txn,
        company_proof_path = nullif(btrim(p_proof_path), ''),
        company_proof_hash = nullif(btrim(p_proof_hash), ''),
        company_marked_paid_at = now(),
        status = 'payment_reported'
    where id = v_pr.id;
  exception when unique_violation then
    raise exception 'That transaction id or proof image has already been used';
  end;

  insert into public.payment_events (payment_request_id, actor_id, event_type, payload)
  values (v_pr.id, v_uid, 'company_reported', jsonb_build_object('txn_id', v_txn));

  -- Automated check: claimed amount must equal the request amount.
  if p_amount_cents is not null and p_amount_cents <> v_pr.amount_cents then
    insert into public.payment_events (payment_request_id, actor_id, event_type, payload)
    values (v_pr.id, v_uid, 'amount_mismatch',
      jsonb_build_object('claimed', p_amount_cents, 'expected', v_pr.amount_cents));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Talent disputes a reported payment (couldn't find the transaction).
-- ---------------------------------------------------------------------------
create function public.dispute_payment(p_submission_id uuid, p_txn_id_entered text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sub public.submissions%rowtype;
  v_pr public.payment_requests%rowtype;
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if not found or v_sub.user_id <> v_uid then
    raise exception 'Only the freelancer can dispute this';
  end if;
  select * into v_pr from public.payment_requests
  where application_id = v_sub.application_id for update;
  if not found or v_pr.company_marked_paid_at is null then
    raise exception 'There is no reported payment to dispute yet';
  end if;
  if v_pr.resolution is not null then
    raise exception 'This payment is already resolved';
  end if;

  update public.payment_requests
  set talent_response = 'disputed',
      talent_txn_id_entered = nullif(btrim(p_txn_id_entered), ''),
      talent_responded_at = now()
  where id = v_pr.id;

  insert into public.payment_events (payment_request_id, actor_id, event_type, payload)
  values (v_pr.id, v_uid, 'talent_disputed', '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin resolutions for the /admin/payments exceptions queue.
-- ---------------------------------------------------------------------------
create function public.admin_resolve_payment(
  p_request_id text,
  p_action text,          -- 'release' | 'fail' | 'request_statement'
  p_note text default null,
  p_strike_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pr public.payment_requests%rowtype;
  v_sub_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  select * into v_pr from public.payment_requests where id = p_request_id for update;
  if not found then
    raise exception 'Payment request not found';
  end if;
  select id into v_sub_id from public.submissions where application_id = v_pr.application_id;

  if p_action = 'release' then
    update public.payment_requests
    set resolution = 'proven', status = 'settled', resolved_by = v_uid, resolved_at = now()
    where id = v_pr.id;
    update public.submissions
    set payment_confirmed_by_talent = true, payment_confirmed_at = now()
    where id = v_sub_id and not payment_confirmed_by_talent;
    update public.payouts
    set status = 'paid', method = coalesce(method, 'juice'), paid_at = now()
    where submission_id = v_sub_id and status = 'owed';
  elsif p_action = 'fail' then
    update public.payment_requests
    set resolution = 'failed', status = 'failed', resolved_by = v_uid, resolved_at = now()
    where id = v_pr.id;
  elsif p_action = 'request_statement' then
    update public.payment_requests
    set status = 'awaiting_statement'
    where id = v_pr.id;
  else
    raise exception 'Unknown action';
  end if;

  insert into public.payment_events (payment_request_id, actor_id, event_type, payload)
  values (v_pr.id, v_uid, 'admin_' || p_action, jsonb_build_object('note', p_note));

  if p_strike_user_id is not null then
    perform public.issue_strike(p_strike_user_id, coalesce(p_note, 'Payment dispute'), v_pr.id);
  end if;
end;
$$;

-- Issue a strike; suspend the user at the threshold. Admin-only (or called from
-- admin_resolve_payment, which checks is_admin()).
create function public.issue_strike(p_user_id uuid, p_reason text, p_request_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  insert into public.user_strikes (user_id, reason, payment_request_id)
  values (p_user_id, p_reason, p_request_id);
  select count(*) into v_count from public.user_strikes where user_id = p_user_id;
  if v_count >= 3 then
    update public.profiles set suspended = true where user_id = p_user_id;
  end if;
  insert into public.payment_events (payment_request_id, actor_id, event_type, payload)
  values (p_request_id, (select auth.uid()), 'strike_issued',
    jsonb_build_object('user_id', p_user_id, 'count', v_count));
end;
$$;

revoke execute on function public.report_payment(uuid, text, text, text, integer) from public, anon;
grant execute on function public.report_payment(uuid, text, text, text, integer) to authenticated;
revoke execute on function public.dispute_payment(uuid, text) from public, anon;
grant execute on function public.dispute_payment(uuid, text) to authenticated;
revoke execute on function public.admin_resolve_payment(text, text, text, uuid) from public, anon;
grant execute on function public.admin_resolve_payment(text, text, text, uuid) to authenticated;
revoke execute on function public.issue_strike(uuid, text, text) from public, anon;
grant execute on function public.issue_strike(uuid, text, text) to authenticated;
