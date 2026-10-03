-- Phase 8 (launch-ready, additive): company verification tiers + job-value cap,
-- company bank details for dispute refunds, and talent Juice merchant QR.

-- ---------------------------------------------------------------------------
-- companies.verification_tier: new companies are capped until an admin promotes
-- them to 'trusted'.
-- ---------------------------------------------------------------------------
alter table public.companies
  add column verification_tier text not null default 'new'
    check (verification_tier in ('new', 'trusted'));

-- Existing companies are the founder's launch companies — trust them so their
-- jobs aren't capped. New self-serve companies default to 'new'.
update public.companies set verification_tier = 'trusted';

-- ---------------------------------------------------------------------------
-- platform_settings: single row of admin-tunable launch settings.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true,
  new_company_job_cap_cents integer not null default 2000 check (new_company_job_cap_cents >= 0),
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);
insert into public.platform_settings (id) values (true);

alter table public.platform_settings enable row level security;
revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to authenticated;
grant update on public.platform_settings to authenticated; -- policy limits to admins

create policy "Signed-in read platform settings"
on public.platform_settings for select to authenticated using (true);
create policy "Admins update platform settings"
on public.platform_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- company_bank_details: beneficiary/bank info for dispute refunds (not routine
-- payouts). Readable/writable by the company owner and admins only.
-- ---------------------------------------------------------------------------
create table public.company_bank_details (
  company_id uuid primary key references public.companies (id) on delete cascade,
  beneficiary_name text check (char_length(beneficiary_name) <= 120),
  bank_name text check (char_length(bank_name) <= 120),
  account_number text check (char_length(account_number) <= 60),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.company_bank_details enable row level security;
revoke all on public.company_bank_details from anon, authenticated;
grant select, insert, update on public.company_bank_details to authenticated;

create policy "Owner and admin read company bank details"
on public.company_bank_details for select to authenticated
using (
  (select public.is_admin())
  or company_id in (select id from public.companies where owner_id = (select auth.uid()))
);
create policy "Owner writes own company bank details"
on public.company_bank_details for insert to authenticated
with check (company_id in (select id from public.companies where owner_id = (select auth.uid())));
create policy "Owner updates own company bank details"
on public.company_bank_details for update to authenticated
using (company_id in (select id from public.companies where owner_id = (select auth.uid())))
with check (company_id in (select id from public.companies where owner_id = (select auth.uid())));

create trigger company_bank_details_set_updated_at
before update on public.company_bank_details
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles.juice_qr_url: talent's Juice merchant QR, shown to a company at
-- payment time (direct-pay model). Collected during payout onboarding.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column juice_qr_url text check (char_length(juice_qr_url) <= 500);

grant update (juice_qr_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Enforce the new-company job-value cap at the database level.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_new_company_job_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier text;
  v_cap integer;
  v_value integer;
begin
  if new.company_id is null then
    return new;
  end if;
  select verification_tier into v_tier from public.companies where id = new.company_id;
  if v_tier is distinct from 'new' then
    return new; -- trusted companies (incl. the launch companies) are uncapped
  end if;
  select new_company_job_cap_cents into v_cap from public.platform_settings where id;
  v_cap := coalesce(v_cap, 2000);
  v_value := case
    when new.pay_type = 'per_unit' then new.pay_cents * greatest(coalesce(new.max_units, 1), 1)
    else new.pay_cents
  end;
  if v_value > v_cap then
    raise exception 'New companies can post jobs worth up to %. Ask an admin to lift the cap.',
      to_char(v_cap / 100.0, 'FM999999990.00');
  end if;
  return new;
end;
$$;

create trigger jobs_enforce_new_company_cap
before insert or update of pay_cents, pay_type, max_units, company_id on public.jobs
for each row execute function public.enforce_new_company_job_cap();

-- ---------------------------------------------------------------------------
-- Admin promotes a company to 'trusted' (lifts the job-value cap).
-- ---------------------------------------------------------------------------
create function public.set_company_tier(p_company_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change a company tier';
  end if;
  if p_tier not in ('new', 'trusted') then
    raise exception 'Invalid tier';
  end if;
  update public.companies set verification_tier = p_tier where id = p_company_id;
end;
$$;

revoke execute on function public.set_company_tier(uuid, text) from public, anon;
grant execute on function public.set_company_tier(uuid, text) to authenticated;
