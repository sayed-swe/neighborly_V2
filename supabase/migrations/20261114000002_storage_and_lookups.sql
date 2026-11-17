-- =====================================================================
--  Storage bucket for photos (post images, avatars, listings, ...)
--  Files are stored as  media/<user-id>/<random-name>.<ext>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media update own" on storage.objects for update to authenticated
  using (bucket_id = 'media' and owner = (select auth.uid()));
create policy "media delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (owner = (select auth.uid()) or (select public.is_admin())));

-- =====================================================================
--  Lookup data (from the original MySQL seed, extended)
-- =====================================================================
insert into public.post_categories (name, icon) values
  ('General','message-circle'), ('Safety','shield'), ('Environment','leaf'),
  ('Education','book-open'), ('Health','heart-pulse'), ('Announcement','megaphone'),
  ('Recommendation','thumbs-up'), ('Question','help-circle')
on conflict (name) do nothing;

insert into public.service_categories (name, icon) values
  ('Plumbing','droplets'), ('Electrician','zap'), ('Tutoring','graduation-cap'),
  ('Cleaning','sparkles'), ('Delivery','truck'), ('Medical','stethoscope'),
  ('Repair & Maintenance','wrench'), ('Mechanic','car'), ('Home Cooking','chef-hat')
on conflict (name) do nothing;

insert into public.neighborhoods (name, area, city, latitude, longitude) values
  ('Green Valley', 'Savar',      'Dhaka',        23.8583, 90.2667),
  ('Lake View',    'Uttara',     'Dhaka',        23.8759, 90.3795),
  ('Dhanmondi',    'Dhanmondi',  'Dhaka',        23.7461, 90.3742),
  ('Mirpur 10',    'Mirpur',     'Dhaka',        23.8069, 90.3687),
  ('Ashulia',      'Ashulia',    'Dhaka',        23.8770, 90.3200),
  ('Court Road',   'Sadar',      'Brahmanbaria', 23.9571, 91.1119)
on conflict (name, city) do nothing;
