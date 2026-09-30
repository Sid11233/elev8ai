-- Phase G: digital products — admin-managed downloadable documents sold via the
-- same manual proof-of-payment flow as courses. Companies/agencies cannot post
-- products; only admins manage them.

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  title text not null check (char_length(title) between 2 and 120),
  summary text check (char_length(summary) <= 300),
  description text check (char_length(description) <= 5000),
  price_cents integer not null check (price_cents >= 0),
  file_path text check (char_length(file_path) <= 500),
  file_name text check (char_length(file_name) <= 200),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_published_idx on public.products (published);

alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select on public.products to authenticated;

-- Everyone signed in sees published products; admins see all.
create policy "Read published products, admins all"
on public.products for select to authenticated
using (published or (select public.is_admin()));

create policy "Admins manage products"
on public.products for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_access: one row per buyer, created when an admin approves a payment.
-- ---------------------------------------------------------------------------
create table public.product_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  amount_cents integer check (amount_cents >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index product_access_user_idx on public.product_access (user_id);

alter table public.product_access enable row level security;
revoke all on public.product_access from anon, authenticated;
grant select on public.product_access to authenticated;

create policy "Read own product access, admins all"
on public.product_access for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

create function public.has_product_access(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.product_access
    where product_id = p_product_id and user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- product_purchases: proof-of-payment requests, verified by an admin.
-- ---------------------------------------------------------------------------
create table public.product_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
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
create index product_purchases_user_idx on public.product_purchases (user_id);
create index product_purchases_status_idx on public.product_purchases (status);
create unique index product_purchases_one_pending_idx
  on public.product_purchases (user_id, product_id) where status = 'pending';

alter table public.product_purchases enable row level security;
revoke all on public.product_purchases from anon, authenticated;
grant select on public.product_purchases to authenticated;

create policy "Read own product purchases, admins all"
on public.product_purchases for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- product-files bucket: private downloadable documents (admin uploads; buyers
-- download through a server route that checks access and signs the URL).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-files', 'product-files', false, 52428800,
  array[
    'application/pdf', 'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'text/plain', 'text/csv'
  ]
);
create policy "Admins upload product files"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-files' and (select public.is_admin()));
create policy "Admins update product files"
on storage.objects for update to authenticated
using (bucket_id = 'product-files' and (select public.is_admin()))
with check (bucket_id = 'product-files' and (select public.is_admin()));
create policy "Admins delete product files"
on storage.objects for delete to authenticated
using (bucket_id = 'product-files' and (select public.is_admin()));
create policy "Admins read product files"
on storage.objects for select to authenticated
using (bucket_id = 'product-files' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Functions: request + review, mirroring courses. Proofs reuse the shared
-- payment-proofs bucket (scoped by uid).
-- ---------------------------------------------------------------------------
create function public.request_product_purchase(
  p_product_id uuid,
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
  v_product public.products%rowtype;
  v_reference text := nullif(btrim(p_reference), '');
  v_proof text := nullif(btrim(p_proof_path), '');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Please log in';
  end if;
  select * into v_product from public.products where id = p_product_id;
  if not found or not v_product.published then
    raise exception 'This product is not available';
  end if;
  if public.has_product_access(p_product_id) then
    raise exception 'You already own this product';
  end if;
  if exists (
    select 1 from public.product_purchases
    where user_id = v_uid and product_id = p_product_id and status = 'pending'
  ) then
    raise exception 'Your payment is already being verified';
  end if;
  if v_proof is null and v_reference is null then
    raise exception 'Upload a screenshot of your payment (or add a reference)';
  end if;
  if v_proof is not null and v_proof not like v_uid::text || '/' || p_product_id::text || '/%' then
    raise exception 'Invalid file';
  end if;

  insert into public.product_purchases (user_id, product_id, amount_cents, reference, note, proof_path)
  values (v_uid, p_product_id, v_product.price_cents, v_reference, nullif(btrim(p_note), ''), v_proof)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.review_product_purchase(
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
  v_p public.product_purchases%rowtype;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can verify payments';
  end if;
  select * into v_p from public.product_purchases where id = p_purchase_id for update;
  if not found or v_p.status <> 'pending' then
    raise exception 'This payment has already been reviewed';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Add a note explaining why the payment was rejected';
  end if;

  update public.product_purchases
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewer_note = v_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_purchase_id;

  if p_approve then
    insert into public.product_access (user_id, product_id, amount_cents)
    values (v_p.user_id, v_p.product_id, v_p.amount_cents)
    on conflict (user_id, product_id) do nothing;
  end if;
end;
$$;

revoke execute on function public.request_product_purchase(uuid, text, text, text) from public, anon;
grant execute on function public.request_product_purchase(uuid, text, text, text) to authenticated;
revoke execute on function public.review_product_purchase(uuid, boolean, text) from public, anon;
grant execute on function public.review_product_purchase(uuid, boolean, text) to authenticated;
