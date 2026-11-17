-- =====================================================================
-- Neighborly — address like city-corporation records
--   * adds thana, city_corporation, postcode to profiles
--   * removes moholla and ward (they were only added on 2026-11-16)
--   * sign-up trigger and the map view use the new fields
-- =====================================================================

alter table public.profiles
  add column if not exists thana            text check (char_length(thana) <= 80),
  add column if not exists city_corporation text check (char_length(city_corporation) <= 80),
  add column if not exists postcode         text check (char_length(postcode) <= 10);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  base_username text;
  final_username text;
  n int := 0;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  is_provider boolean := coalesce(meta->>'account_type', '') = 'service_provider';
  nb bigint := nullif(meta->>'neighborhood_id','')::bigint;
  lat double precision;
  lng double precision;
begin
  base_username := lower(regexp_replace(
    coalesce(nullif(meta->>'username',''), split_part(new.email, '@', 1), 'neighbor'),
    '[^a-zA-Z0-9_.]', '', 'g'));
  if char_length(base_username) < 3 then base_username := base_username || 'user'; end if;
  base_username := left(base_username, 24);
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    n := n + 1;
    final_username := base_username || n::text;
  end loop;

  begin
    lat := nullif(meta->>'latitude','')::double precision;
    lng := nullif(meta->>'longitude','')::double precision;
    if lat not between -90 and 90 or lng not between -180 and 180 then lat := null; lng := null; end if;
  exception when others then lat := null; lng := null;
  end;

  insert into public.profiles (id, full_name, username, phone, neighborhood_id, role,
                               house, road, thana, city_corporation, postcode, latitude, longitude, show_on_map)
  values (
    new.id,
    left(coalesce(nullif(meta->>'full_name',''), split_part(new.email, '@', 1), 'Neighbor'), 100),
    final_username,
    left(nullif(meta->>'phone',''), 20),
    nb,
    case when is_provider then 'service_provider'::public.user_role else 'resident'::public.user_role end,
    left(nullif(meta->>'house',''), 60), left(nullif(meta->>'road',''), 120),
    left(nullif(meta->>'thana',''), 80), left(nullif(meta->>'city_corporation',''), 80), left(nullif(meta->>'postcode',''), 10),
    lat, lng,
    lat is not null and coalesce(meta->>'show_on_map','') = 'true'
  );

  -- A provider's first service is created from the sign-up form. Never block sign-up on it.
  if is_provider and nullif(meta->>'service_name','') is not null then
    begin
      insert into public.services (provider_id, neighborhood_id, service_category_id, service_name, description,
                                   contact_phone, contact_email, price_info, latitude, longitude)
      values (new.id, nb, (meta->>'service_category_id')::bigint, left(meta->>'service_name', 150),
              left(coalesce(nullif(meta->>'service_description',''), meta->>'service_name'), 3000),
              left(meta->>'phone', 20), coalesce(nullif(meta->>'contact_email',''), new.email),
              left(nullif(meta->>'price_info',''), 100), lat, lng);
    exception when others then null;
    end;
  end if;
  return new;
end $$;

create or replace view public.map_items with (security_invoker = true) as
  select 'post'::text as kind, id::text as item_id, coalesce(title, left(body, 80)) as title,
         location_name as subtitle, latitude, longitude, created_at
    from public.posts where latitude is not null and status = 'published'
  union all
  select 'listing', id::text, title, coalesce(location_name, listing_type::text), latitude, longitude, created_at
    from public.marketplace_listings where latitude is not null and status in ('available','reserved')
  union all
  select 'lost_found', id::text, initcap(report_type::text) || ': ' || item_name, location, latitude, longitude, created_at
    from public.lost_found_items where latitude is not null and status = 'open'
  union all
  select 'event', id::text, title, location, latitude, longitude, created_at
    from public.events where latitude is not null and status in ('upcoming','ongoing')
  union all
  select 'help', id::text, title, help_type::text, latitude, longitude, created_at
    from public.help_requests where latitude is not null and status in ('open','in_progress')
  union all
  select 'alert', id::text, title, coalesce(location_name, severity::text), latitude, longitude, created_at
    from public.emergency_alerts where latitude is not null and status = 'active'
  union all
  select 'service', id::text, service_name, price_info, latitude, longitude, created_at
    from public.services where latitude is not null and is_active
  union all
  select 'neighbor', username, full_name, nullif(concat_ws(', ', house, road, thana), ''), latitude, longitude, created_at
    from public.profiles where show_on_map and latitude is not null and status = 'active';

alter table public.profiles drop column if exists moholla, drop column if exists ward;
