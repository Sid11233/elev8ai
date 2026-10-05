-- Encryption at rest for the genuinely sensitive data stores: bank/Juice
-- payout details and company bank details kept for refunds. These need to be
-- RETRIEVED in original form (to show on the payment page / to the company),
-- so this is reversible encryption, not one-way hashing — hashing is for
-- values that only ever need to be *verified*, never redisplayed. (This app
-- has no app-managed passwords: auth is Supabase Auth magic-link/OAuth only,
-- so there's nothing to bcrypt here.)
--
-- Uses pgcrypto's pgp_sym_encrypt/decrypt (stateless, no manual nonce
-- management — a far safer primitive to apply by hand than pgsodium's
-- lower-level AEAD API) with the key held in Supabase Vault, so the key
-- material never appears in application code or is readable by a normal
-- authenticated/anon role — only these SECURITY DEFINER functions can see it.
-- Encryption/decryption is transparent to existing app code via triggers, so
-- write call sites don't change; the handful of read call sites switch to a
-- decrypt RPC.
--
-- pgcrypto installs into the "extensions" schema on Supabase, not "public" —
-- every reference below is schema-qualified since these functions run with
-- search_path = ''.

create extension if not exists supabase_vault;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'payout_data_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'payout_data_key',
      'Symmetric key for encrypting payout_details.details and company_bank_details.account_number'
    );
  end if;
end $$;

create function public.payout_data_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'payout_data_key';
$$;
-- Not callable by anyone except the triggers/functions below (SECURITY
-- DEFINER functions run as their owner regardless of grants, but revoke
-- explicitly as defense-in-depth).
revoke execute on function public.payout_data_key() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- payout_details.details: encrypt transparently on write, decrypt only
-- through a dedicated read path.
-- ---------------------------------------------------------------------------
alter table public.payout_details add column details_encrypted bytea;

create function public.encrypt_payout_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.details is not null then
    new.details_encrypted := extensions.pgp_sym_encrypt(new.details::text, public.payout_data_key());
  end if;
  -- Never persist the plaintext column once it's encrypted.
  new.details := '{}'::jsonb;
  return new;
end;
$$;
create trigger payout_details_encrypt
before insert or update of details on public.payout_details
for each row execute function public.encrypt_payout_details();
revoke execute on function public.encrypt_payout_details() from public, anon, authenticated;

-- Decrypted read, scoped exactly like the existing RLS (owner or admin).
create function public.get_payout_details(p_user_id uuid)
returns table (method text, details jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null for the service role (already the most-trusted caller,
  -- e.g. the public payment page, which independently validates the payment
  -- token before calling this) as well as for anon — but anon is blocked from
  -- calling this function at all via REVOKE, so a null auth.uid() here can
  -- only mean service_role.
  if (select auth.uid()) is not null
     and p_user_id <> (select auth.uid())
     and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return query
  select pd.method,
    case when pd.details_encrypted is null then '{}'::jsonb
      else extensions.pgp_sym_decrypt(pd.details_encrypted, public.payout_data_key())::jsonb
    end
  from public.payout_details pd
  where pd.user_id = p_user_id;
end;
$$;
revoke execute on function public.get_payout_details(uuid) from public, anon;
grant execute on function public.get_payout_details(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- company_bank_details.account_number: same pattern.
-- ---------------------------------------------------------------------------
alter table public.company_bank_details add column account_number_encrypted bytea;

create function public.encrypt_company_bank_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_number is not null then
    new.account_number_encrypted := extensions.pgp_sym_encrypt(new.account_number, public.payout_data_key());
  end if;
  new.account_number := null;
  return new;
end;
$$;
create trigger company_bank_details_encrypt
before insert or update of account_number on public.company_bank_details
for each row execute function public.encrypt_company_bank_details();
revoke execute on function public.encrypt_company_bank_details() from public, anon, authenticated;

create function public.get_company_bank_details(p_company_id uuid)
returns table (beneficiary_name text, bank_name text, account_number text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin()
     and not exists (select 1 from public.companies where id = p_company_id and owner_id = (select auth.uid())) then
    raise exception 'Not allowed';
  end if;
  return query
  select cbd.beneficiary_name, cbd.bank_name,
    case when cbd.account_number_encrypted is null then null
      else extensions.pgp_sym_decrypt(cbd.account_number_encrypted, public.payout_data_key())
    end
  from public.company_bank_details cbd
  where cbd.company_id = p_company_id;
end;
$$;
revoke execute on function public.get_company_bank_details(uuid) from public, anon;
grant execute on function public.get_company_bank_details(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: force existing rows through the new encrypt triggers.
-- ---------------------------------------------------------------------------
update public.payout_details set details = details where details_encrypted is null and details is not null and details <> '{}'::jsonb;
update public.company_bank_details set account_number = account_number where account_number_encrypted is null and account_number is not null;
