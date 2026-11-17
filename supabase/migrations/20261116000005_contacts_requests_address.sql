-- =====================================================================
--  Neighborly 0005
--   * user address parts (house, road, moholla, ward) + opt-in map pin
--   * contact phone / email on listings, lost & found and help requests
--   * photos in chat messages
--   * separate registration for residents and service providers
--   * service requests: a resident asks, the provider accepts / declines
--   * neighbors who opt in appear on the map
--  Additive only: existing clients (web, Android) keep working.
-- =====================================================================

alter table public.profiles
  add column if not exists house       text check (char_length(house) <= 60),
  add column if not exists road        text check (char_length(road) <= 120),
  add column if not exists moholla     text check (char_length(moholla) <= 120),
  add column if not exists ward        text check (char_length(ward) <= 60),
  add column if not exists show_on_map boolean not null default false;

alter table public.marketplace_listings
  add column if not exists contact_phone text check (char_length(contact_phone) <= 20),
  add column if not exists contact_email text check (char_length(contact_email) <= 120);
alter table public.lost_found_items
  add column if not exists contact_phone text check (char_length(contact_phone) <= 20),
  add column if not exists contact_email text check (char_length(contact_email) <= 120);
alter table public.help_requests
  add column if not exists contact_phone text check (char_length(contact_phone) <= 20),
  add column if not exists contact_email text check (char_length(contact_email) <= 120);

-- ---------- chat photos: a message needs text or an image ----------
alter table public.messages add column if not exists image_url text;
alter table public.messages alter column body set default '';
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check
  check (char_length(body) <= 4000 and (char_length(trim(body)) > 0 or image_url is not null));

create or replace function public.my_conversations()
returns table (
  conversation_id bigint, other_user_id uuid, other_name text, other_username text, other_avatar text,
  last_message text, last_sender_id uuid, last_message_at timestamptz, unread_count bigint
) language sql stable security definer set search_path = '' as $$
  select c.id, o.user_id, p.full_name, p.username, p.avatar_url,
    case when coalesce(trim(lm.body), '') = '' and lm.image_url is not null then '📷 Photo' else lm.body end,
    lm.sender_id, c.last_message_at,
    (select count(*) from public.messages m
      where m.conversation_id = c.id and m.sender_id <> (select auth.uid()) and m.created_at > me.last_read_at)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  left join lateral (
    select m.body, m.image_url, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = (select auth.uid())
  order by c.last_message_at desc;
$$;

-- ---------- sign-up: resident or service provider ----------
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
                               house, road, moholla, ward, latitude, longitude, show_on_map)
  values (
    new.id,
    left(coalesce(nullif(meta->>'full_name',''), split_part(new.email, '@', 1), 'Neighbor'), 100),
    final_username,
    left(nullif(meta->>'phone',''), 20),
    nb,
    case when is_provider then 'service_provider'::public.user_role else 'resident'::public.user_role end,
    left(nullif(meta->>'house',''), 60), left(nullif(meta->>'road',''), 120),
    left(nullif(meta->>'moholla',''), 120), left(nullif(meta->>'ward',''), 60),
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

-- ---------- service requests ----------
do $$ begin
  create type public.request_status as enum ('pending','accepted','declined','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.service_requests (
  id              bigint generated always as identity primary key,
  service_id      bigint not null references public.services(id) on delete cascade,
  requester_id    uuid   not null references public.profiles(id) on delete cascade,
  provider_id     uuid   not null references public.profiles(id) on delete cascade,
  details         text   not null check (char_length(details) between 1 and 2000),
  preferred_time  text   check (char_length(preferred_time) <= 120),
  address         text   check (char_length(address) <= 255),
  contact_phone   text   check (char_length(contact_phone) <= 20),
  status          public.request_status not null default 'pending',
  provider_note   text   check (char_length(provider_note) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists service_requests_service_idx   on public.service_requests(service_id);
create index if not exists service_requests_requester_idx on public.service_requests(requester_id, created_at desc);
create index if not exists service_requests_provider_idx  on public.service_requests(provider_id, status, created_at desc);

-- provider_id always comes from the service, never from the client
create or replace function public.service_request_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select provider_id into new.provider_id from public.services where id = new.service_id and is_active;
  if new.provider_id is null then raise exception 'This service is not available'; end if;
  if new.provider_id = new.requester_id then raise exception 'You cannot request your own service'; end if;
  new.status := 'pending';
  new.provider_note := null;
  return new;
end $$;
create trigger service_requests_before_insert before insert on public.service_requests
  for each row execute function public.service_request_before_insert();

-- who may change what: provider accepts / declines / completes, requester cancels
create or replace function public.service_request_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  new.service_id := old.service_id; new.requester_id := old.requester_id; new.provider_id := old.provider_id;
  if me is not null and not public.is_admin() then
    if me = old.provider_id then
      if not ((old.status = 'pending'  and new.status in ('pending','accepted','declined'))
           or (old.status = 'accepted' and new.status in ('accepted','completed'))
           or new.status = old.status) then
        raise exception 'That status change is not allowed';
      end if;
      new.details := old.details; new.preferred_time := old.preferred_time;
      new.address := old.address; new.contact_phone := old.contact_phone;
    else
      if new.status <> old.status and not (old.status in ('pending','accepted') and new.status = 'cancelled') then
        raise exception 'You can only cancel this request';
      end if;
      new.provider_note := old.provider_note;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger service_requests_before_update before update on public.service_requests
  for each row execute function public.service_request_before_update();

create or replace function public.on_service_request_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare svc text := (select service_name from public.services where id = new.service_id);
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.provider_id, new.requester_id, 'service',
      public.actor_name(new.requester_id) || ' requested your service: ' || svc, '/services?tab=incoming', new.id);
  elsif new.status <> old.status then
    if new.status = 'cancelled' then
      perform public.notify(new.provider_id, new.requester_id, 'service',
        public.actor_name(new.requester_id) || ' cancelled the request for ' || svc, '/services?tab=incoming', new.id);
    else
      perform public.notify(new.requester_id, new.provider_id, 'service',
        public.actor_name(new.provider_id) || ' ' || new.status::text || ' your request for ' || svc,
        '/services?tab=requests', new.id);
    end if;
  end if;
  return new;
end $$;
create trigger service_requests_notify after insert or update on public.service_requests
  for each row execute function public.on_service_request_change();

alter table public.service_requests enable row level security;
create policy "requests read own" on public.service_requests for select to authenticated
  using (requester_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "requests insert own" on public.service_requests for insert to authenticated
  with check (requester_id = (select auth.uid()) and (select public.is_active_user()));
create policy "requests update parties" on public.service_requests for update to authenticated
  using (requester_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select public.is_admin()))
  with check (requester_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "requests delete own or admin" on public.service_requests for delete to authenticated
  using (requester_id = (select auth.uid()) or (select public.is_admin()));

revoke execute on function public.service_request_before_insert(), public.service_request_before_update(),
  public.on_service_request_change() from public, anon, authenticated;

-- ---------- map: neighbors who chose to be shown ----------
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
  select 'neighbor', username, full_name, nullif(concat_ws(', ', moholla, road), ''), latitude, longitude, created_at
    from public.profiles where show_on_map and latitude is not null and status = 'active';
