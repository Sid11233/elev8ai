-- Fix: the encrypt triggers were scoped to "UPDATE OF details"/"OF
-- account_number", which did not reliably fire on PostgREST's upsert path
-- (INSERT ... ON CONFLICT DO UPDATE) — verified live: a plain UPDATE encrypted
-- correctly, but .upsert() (the write path both actions actually use) silently
-- left the new plaintext unencrypted and undecryptable.
--
-- Fix: make the trigger unconditional (BEFORE INSERT OR UPDATE, no column
-- scoping — removes any dependency on how the write statement's SET-list is
-- shaped) but only touch details_encrypted when NEW.details actually carries
-- new, non-empty plaintext. This also guards the data-destroying case an
-- unconditional trigger would otherwise introduce: an unrelated update that
-- doesn't include `details` in its payload still carries the row's *current*
-- value in NEW.details (by now always '{}' once encrypted) — without this
-- guard, every such update would re-encrypt '{}' over the real ciphertext and
-- silently destroy it.

create or replace function public.encrypt_payout_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.details is not null and new.details <> '{}'::jsonb then
    new.details_encrypted := extensions.pgp_sym_encrypt(new.details::text, public.payout_data_key());
    new.details := '{}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists payout_details_encrypt on public.payout_details;
create trigger payout_details_encrypt
before insert or update on public.payout_details
for each row execute function public.encrypt_payout_details();

create or replace function public.encrypt_company_bank_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_number is not null and new.account_number <> '' then
    new.account_number_encrypted := extensions.pgp_sym_encrypt(new.account_number, public.payout_data_key());
    new.account_number := null;
  end if;
  return new;
end;
$$;

drop trigger if exists company_bank_details_encrypt on public.company_bank_details;
create trigger company_bank_details_encrypt
before insert or update on public.company_bank_details
for each row execute function public.encrypt_company_bank_details();
