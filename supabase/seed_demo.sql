-- =====================================================================
--  OPTIONAL demo data — run once in the Supabase SQL editor after the
--  migrations, so the app has neighbors, posts, listings, etc. to show.
--
--  Demo logins (change or delete these before going public):
--    admin@neighborly.test   /  Admin@12345     (admin)
--    rahim@neighborly.test   /  Neighbor@123
--    karima@neighborly.test  /  Neighbor@123
--    sohel@neighborly.test   /  Neighbor@123    (service provider)
--    nusrat@neighborly.test  /  Neighbor@123
-- =====================================================================
do $$
declare
  u record;
  nb_ashulia bigint := (select id from public.neighborhoods where name = 'Ashulia');
  nb_green   bigint := (select id from public.neighborhoods where name = 'Green Valley');
  a uuid := '11111111-1111-1111-1111-111111111111';
  r uuid := '22222222-2222-2222-2222-222222222222';
  k uuid := '33333333-3333-3333-3333-333333333333';
  s uuid := '44444444-4444-4444-4444-444444444444';
  n uuid := '55555555-5555-5555-5555-555555555555';
  p1 bigint; p2 bigint; p3 bigint; p4 bigint; ev bigint; hr bigint; cid bigint;
begin
  if exists (select 1 from auth.users where id = a) then
    raise notice 'Demo data already loaded'; return;
  end if;

  for u in select * from (values
    (a, 'admin@neighborly.test',  'Admin@12345',  'Site Admin',     'admin',    nb_ashulia),
    (r, 'rahim@neighborly.test',  'Neighbor@123', 'Rahim Uddin',    'rahim',    nb_ashulia),
    (k, 'karima@neighborly.test', 'Neighbor@123', 'Karima Begum',   'karima',   nb_ashulia),
    (s, 'sohel@neighborly.test',  'Neighbor@123', 'Sohel Electric', 'sohel_el', nb_green),
    (n, 'nusrat@neighborly.test', 'Neighbor@123', 'Nusrat Jahan',   'nusrat',   nb_ashulia)
  ) as t(id, email, pw, full_name, username, nb)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt(u.pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.full_name, 'username', u.username, 'neighborhood_id', u.nb),
      now(), now(), '', '', '', '');

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;

  update public.profiles set role = 'admin' where id = a;
  update public.profiles set role = 'service_provider', bio = 'Licensed electrician, 8 years in the area' where id = s;
  update public.profiles set bio = 'Long-time resident. Love gardening.', address = 'House 12, Road 3' where id = r;
  update public.profiles set bio = 'Teacher and community volunteer' where id = k;

  insert into public.posts (user_id, neighborhood_id, category_id, post_type, title, body, location_name, latitude, longitude)
  values (a, nb_ashulia, (select id from public.post_categories where name = 'Announcement'), 'announcement',
          'Scheduled water supply maintenance',
          'Water supply will be off tomorrow from 10:00 AM to 2:00 PM for pipeline maintenance in Block-B. Please store water tonight.',
          'Block-B', 23.8762, 90.3215)
  returning id into p1;

  insert into public.posts (user_id, neighborhood_id, category_id, body, location_name, latitude, longitude)
  values (r, nb_ashulia, (select id from public.post_categories where name = 'Safety'),
          'Street light near the mosque gate has been off for 3 nights. It gets really dark on the walk home — has anyone already reported it?',
          'Mosque road', 23.8775, 90.3198)
  returning id into p2;

  insert into public.posts (user_id, neighborhood_id, category_id, body)
  values (k, nb_ashulia, (select id from public.post_categories where name = 'Recommendation'),
          'Huge thanks to whoever organised the clean-up last Friday 🌱 The park looks amazing. Who is in for next month?')
  returning id into p3;

  insert into public.posts (user_id, neighborhood_id, category_id, body)
  values (n, nb_ashulia, (select id from public.post_categories where name = 'Question'),
          'Any good Bangla / English home tutor for class 6 around here? Budget is flexible.')
  returning id into p4;

  insert into public.posts (user_id, neighborhood_id, body, shared_post_id)
  values (k, nb_ashulia, 'Sharing so everyone sees this 👇', p1);

  insert into public.reactions (user_id, post_id, reaction_type) values
    (r, p1, 'like'), (k, p1, 'like'), (n, p1, 'care'), (s, p1, 'like'),
    (k, p2, 'sad'), (n, p2, 'like'), (a, p2, 'like'),
    (r, p3, 'love'), (n, p3, 'love'), (a, p3, 'like'), (s, p3, 'wow');

  insert into public.comments (user_id, post_id, content) values
    (k, p1, 'Thanks for the heads-up!'),
    (n, p1, 'Will the Block-C side be affected too?'),
    (a, p2, 'Reported to the city office this morning. Will update here.'),
    (r, p3, 'Count me in 🙌'),
    (s, p4, 'My sister tutors class 6–8, I''ll DM you her number.');

  insert into public.events (created_by, neighborhood_id, title, description, starts_at, location, latitude, longitude, max_participants)
  values (k, nb_ashulia, 'Community clean-up day', 'Gloves and bags provided. Meet at the park gate.',
          date_trunc('day', now()) + interval '6 days 8 hours', 'Green park gate', 23.8781, 90.3226, 40)
  returning id into ev;
  insert into public.events (created_by, neighborhood_id, title, description, starts_at, location, latitude, longitude)
  values (a, nb_ashulia, 'Free blood-group check camp', 'Volunteers from the local clinic. All ages welcome.',
          date_trunc('day', now()) + interval '10 days 10 hours', 'Community hall', 23.8750, 90.3190);
  insert into public.event_participants (event_id, user_id, rsvp) values (ev, r, 'going'), (ev, n, 'interested');

  insert into public.help_requests (user_id, neighborhood_id, help_type, title, details, latitude, longitude)
  values (r, nb_ashulia, 'grocery', 'Need groceries this week',
          'Recovering from a fever and can''t go out. Need rice, eggs and vegetables — will pay back.', 23.8770, 90.3205)
  returning id into hr;
  insert into public.help_responses (help_request_id, responder_id, message) values (hr, k, 'I can bring them tomorrow morning.');

  insert into public.services (provider_id, neighborhood_id, service_category_id, service_name, description, contact_phone, price_info, latitude, longitude, is_verified)
  values
    (s, nb_green, (select id from public.service_categories where name = 'Electrician'),
     'Home electrical repair', 'Wiring, fan, light and switchboard repair at home. Same-day visits.', '01700000004', 'From 300 BDT', 23.8590, 90.2670, true),
    (k, nb_ashulia, (select id from public.service_categories where name = 'Tutoring'),
     'Math & science tutoring (class 6–10)', 'Experienced school teacher. Evening batches available.', '01700000003', '2,500 BDT / month', 23.8765, 90.3230, false);

  insert into public.marketplace_listings (user_id, neighborhood_id, listing_type, title, description, category, item_condition, price, location_name, latitude, longitude)
  values
    (n, nb_ashulia, 'sell', 'Mountain bicycle', 'Nearly new, 21 gears, serviced last month.', 'Vehicles', 'like_new', 4500, 'Block-A', 23.8758, 90.3201),
    (r, nb_ashulia, 'sell', 'Wooden study table', 'Solid wood, good condition. Pick-up only.', 'Furniture', 'used', 2500, 'Road 3', 23.8772, 90.3210),
    (k, nb_ashulia, 'free', 'Class 8 textbooks', 'Full set, free for any student who needs them.', 'Books', 'used', null, 'Block-C', 23.8768, 90.3236);

  insert into public.lost_found_items (user_id, neighborhood_id, report_type, item_name, description, location, latitude, longitude, date_occurred)
  values
    (k, nb_ashulia, 'lost', 'Black wallet', 'Lost near the park gate. Has my NID and some cash.', 'Park gate', 23.8780, 90.3224, current_date - 2),
    (n, nb_ashulia, 'found', 'House keys with blue keychain', 'Found on the footpath near the pharmacy.', 'Pharmacy corner', 23.8755, 90.3212, current_date - 1);

  insert into public.emergency_alerts (created_by, neighborhood_id, title, message, severity, location_name, latitude, longitude)
  values (a, nb_ashulia, 'Gas leakage warning', 'Gas leakage reported on Road 3. Avoid open flames; Titas has been informed.', 'high', 'Road 3', 23.8771, 90.3208);

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (n, 'post', p4::text, 'spam', 'Sample report to test the moderation flow.');

  -- one demo conversation
  insert into public.conversations default values returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, r), (cid, n);
  insert into public.messages (conversation_id, sender_id, body) values
    (cid, r, 'Hi! Is the bicycle still available?'),
    (cid, n, 'Yes it is — you can come see it after 5pm.');
end $$;
