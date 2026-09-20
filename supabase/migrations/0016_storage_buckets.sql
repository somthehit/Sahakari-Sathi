-- 0016: Storage buckets for member media and organizational documents.
--
-- Buckets:
--   member-photos    - passport/profile photos (public read for display)
--   member-documents - KYC documents, citizenship, signatures (private)
--   certificates     - share certificates, bonus letters (public read)
--   invoices-bills   - invoices, bills, payment receipts (private)
--   payroll          - payroll runs, payslips, salary registers (private)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('member-photos',   'member-photos',   true,  5242880,  array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('member-documents','member-documents',false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('certificates',    'certificates',    true,  10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('invoices-bills',  'invoices-bills',  false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel']),
  ('payroll',         'payroll',         false, 10485760, array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv'])
on conflict (id) do nothing;

-- RLS: public (anon) read for buckets that display media in the UI.
drop policy if exists "Public read member-photos" on storage.objects;
create policy "Public read member-photos" on storage.objects
  for select using (bucket_id = 'member-photos');

drop policy if exists "Public read certificates" on storage.objects;
create policy "Public read certificates" on storage.objects
  for select using (bucket_id = 'certificates');

-- RLS: authenticated users manage objects in all five buckets.
drop policy if exists "Authenticated upload all buckets" on storage.objects;
create policy "Authenticated upload all buckets" on storage.objects
  for insert to authenticated with check (bucket_id in ('member-photos','member-documents','certificates','invoices-bills','payroll'));

drop policy if exists "Authenticated read all buckets" on storage.objects;
create policy "Authenticated read all buckets" on storage.objects
  for select to authenticated using (bucket_id in ('member-photos','member-documents','certificates','invoices-bills','payroll'));

drop policy if exists "Authenticated update all buckets" on storage.objects;
create policy "Authenticated update all buckets" on storage.objects
  for update to authenticated using (bucket_id in ('member-photos','member-documents','certificates','invoices-bills','payroll'));

drop policy if exists "Authenticated delete all buckets" on storage.objects;
create policy "Authenticated delete all buckets" on storage.objects
  for delete to authenticated using (bucket_id in ('member-photos','member-documents','certificates','invoices-bills','payroll'));
