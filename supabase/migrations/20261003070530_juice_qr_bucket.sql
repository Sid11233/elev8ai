-- Talent Juice merchant QR images. Public read (the QR is meant to be shown to
-- the paying company), talent writes only to their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'juice-qr', 'juice-qr', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "Users upload own juice qr"
on storage.objects for insert to authenticated
with check (bucket_id = 'juice-qr' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update own juice qr"
on storage.objects for update to authenticated
using (bucket_id = 'juice-qr' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'juice-qr' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete own juice qr"
on storage.objects for delete to authenticated
using (bucket_id = 'juice-qr' and (storage.foldername(name))[1] = (select auth.uid())::text);
