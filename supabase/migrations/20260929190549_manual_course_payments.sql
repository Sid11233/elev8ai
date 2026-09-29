-- Replace Lemon Squeezy with manual proof-of-payment course access:
-- talent pay by Juice/MCB, upload proof, an admin verifies and grants access.

-- Lemon Squeezy is gone.
alter table public.courses drop column if exists lemon_variant_id;

-- ---------------------------------------------------------------------------
-- payment_settings: single row of instructions talent see when buying.
-- ---------------------------------------------------------------------------
create table public.payment_settings (
  id boolean primary key default true,
  instructions_md text check (char_length(instructions_md) <= 3000),
  account_details text check (char_length(account_details) <= 1000),
  qr_url text check (char_length(qr_url) <= 500),
  updated_at timestamptz not null default now(),
  constraint payment_settings_singleton check (id)
);
insert into public.payment_settings (id, instructions_md, account_details)
values (
  true,
  'Pay by **MCB Juice** or bank transfer, then upload a screenshot of your payment below. We verify within 24 hours and unlock your course.',
  'MCB Juice: [your number] · Account name: [your name]'
);

alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from anon, authenticated;
grant select on public.payment_settings to authenticated;
grant update on public.payment_settings to authenticated; -- policy limits to admins

create policy "Signed-in read payment settings"
on public.payment_settings for select to authenticated using (true);
create policy "Admins update payment settings"
on public.payment_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger payment_settings_set_updated_at
before update on public.payment_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- course_purchases: proof-of-payment requests, verified by an admin.
-- ---------------------------------------------------------------------------
create table public.course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  amount_cents integer check (amount_cents >= 0),
  reference text check (char_length(reference) <= 200),
  note text check (char_length(note) <= 1000),
  proof_path text check (char_length(proof_path) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text check (char_length(reviewer_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index course_purchases_user_idx on public.course_purchases (user_id);
create index course_purchases_status_idx on public.course_purchases (status);
create unique index course_purchases_one_pending_idx
  on public.course_purchases (user_id, course_id) where status = 'pending';

alter table public.course_purchases enable row level security;
revoke all on public.course_purchases from anon, authenticated;
grant select on public.course_purchases to authenticated;

create policy "Users read own purchases, admins all"
on public.course_purchases for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Buckets: private proofs (talent upload), public QR asset (admin manages).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);
create policy "Users upload own payment proofs"
on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users read own payment proofs, admins all"
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-assets', 'payment-assets', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);
create policy "Admins upload payment assets"
on storage.objects for insert to authenticated
with check (bucket_id = 'payment-assets' and (select public.is_admin()));
create policy "Admins update payment assets"
on storage.objects for update to authenticated
using (bucket_id = 'payment-assets' and (select public.is_admin()))
with check (bucket_id = 'payment-assets' and (select public.is_admin()));
create policy "Admins delete payment assets"
on storage.objects for delete to authenticated
using (bucket_id = 'payment-assets' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Talent submit proof of payment for a course (or resubmit after a rejection).
create function public.request_course_purchase(
  p_course_id uuid,
  p_proof_path text,
  p_reference text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course public.courses%rowtype;
  v_reference text := nullif(btrim(p_reference), '');
  v_proof text := nullif(btrim(p_proof_path), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please log in';
  end if;
  select * into v_course from public.courses where id = p_course_id;
  if not found or not v_course.published then
    raise exception 'This course is not available';
  end if;
  if public.has_course_access(p_course_id) then
    raise exception 'You already have this course';
  end if;
  if exists (
    select 1 from public.course_purchases
    where user_id = v_uid and course_id = p_course_id and status = 'pending'
  ) then
    raise exception 'Your payment is already being verified';
  end if;
  if v_proof is null and v_reference is null then
    raise exception 'Upload a screenshot of your payment (or add a reference)';
  end if;
  if v_proof is not null and v_proof not like v_uid::text || '/' || p_course_id::text || '/%' then
    raise exception 'Invalid file';
  end if;

  insert into public.course_purchases (user_id, course_id, amount_cents, reference, note, proof_path)
  values (v_uid, p_course_id, v_course.price_cents, v_reference, nullif(btrim(p_note), ''), v_proof)
  returning id into v_id;
  return v_id;
end;
$$;

-- Admin verifies a payment. Approving grants course access in the same
-- transaction. Rejecting requires a note.
create function public.review_course_purchase(
  p_purchase_id uuid,
  p_approve boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.course_purchases%rowtype;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can verify payments';
  end if;
  select * into v_p from public.course_purchases where id = p_purchase_id for update;
  if not found or v_p.status <> 'pending' then
    raise exception 'This payment has already been reviewed';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Add a note explaining why the payment was rejected';
  end if;

  update public.course_purchases
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewer_note = v_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_purchase_id;

  if p_approve then
    insert into public.course_access (user_id, course_id, order_id, amount_cents)
    values (v_p.user_id, v_p.course_id, 'manual:' || v_p.id::text, v_p.amount_cents)
    on conflict (user_id, course_id) do nothing;
  end if;
end;
$$;

revoke execute on function
  public.request_course_purchase(uuid, text, text, text),
  public.review_course_purchase(uuid, boolean, text)
from public, anon;
grant execute on function
  public.request_course_purchase(uuid, text, text, text),
  public.review_course_purchase(uuid, boolean, text)
to authenticated;
