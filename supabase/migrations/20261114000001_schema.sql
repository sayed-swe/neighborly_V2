-- =====================================================================
--  Neighborly — Supabase (PostgreSQL) schema
--  Converted from the original MySQL schema (docs/legacy-mysql-schema.sql)
--
--  What changed vs. the MySQL version:
--   * users + user_profiles  -> public.profiles, linked 1:1 to Supabase Auth
--     (auth.users holds email + password, so no password_hash column here)
--   * roles table            -> user_role enum (resident / service_provider / moderator / admin)
--   * MySQL ENUMs            -> Postgres enum types
--   * AUTO_INCREMENT         -> bigint identity
--   * Facebook-style extras  -> 7 reaction types, threaded comment replies,
--                               shares (a post that points at another post)
--   * New: direct messages (conversations / members / messages)
--   * New: latitude / longitude on location-based content (for the Map)
--   * Row Level Security on every table + admin helpers
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------
create type public.user_role         as enum ('resident','service_provider','moderator','admin');
create type public.user_status       as enum ('active','suspended','banned');
create type public.gender_type       as enum ('male','female','other');
create type public.post_type         as enum ('post','announcement');
create type public.content_status    as enum ('published','hidden','deleted');
create type public.comment_status    as enum ('visible','hidden','deleted');
create type public.reaction_type     as enum ('like','love','care','haha','wow','sad','angry');
create type public.event_status      as enum ('upcoming','ongoing','completed','cancelled');
create type public.rsvp_status       as enum ('going','interested');
create type public.help_type         as enum ('medical','grocery','repair','transport','childcare','elderly_care','other');
create type public.help_status       as enum ('open','in_progress','resolved','closed');
create type public.listing_type      as enum ('sell','buy','exchange','free');
create type public.item_condition    as enum ('new','like_new','used','for_parts');
create type public.listing_status    as enum ('available','reserved','sold','closed');
create type public.lf_type           as enum ('lost','found');
create type public.lf_status         as enum ('open','resolved');
create type public.alert_severity    as enum ('low','medium','high','critical');
create type public.alert_status      as enum ('active','resolved','expired');
create type public.notification_type as enum ('post','event','help_request','service','marketplace','lost_found',
                                              'emergency','comment','reaction','share','message','report','system');
create type public.report_target     as enum ('post','comment','event','help_request','service','listing','lost_found','user');
create type public.report_reason     as enum ('spam','abuse','inappropriate','scam','false_info','harassment','other');
create type public.report_status     as enum ('pending','under_review','resolved','dismissed');
create type public.report_action     as enum ('none','content_removed','warning_sent','user_suspended','user_banned');

-- ---------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. Neighborhoods
-- ---------------------------------------------------------------------
create table public.neighborhoods (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 2 and 120),
  area        text,
  city        text,
  latitude    double precision check (latitude between -90 and 90),
  longitude   double precision check (longitude between -180 and 180),
  created_at  timestamptz not null default now(),
  unique (name, city)
);

-- ---------------------------------------------------------------------
-- 2. Profiles (users + user_profiles merged, linked to auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text not null check (char_length(full_name) between 1 and 100),
  username         text not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  phone            text check (char_length(phone) <= 20),
  role             public.user_role   not null default 'resident',
  status           public.user_status not null default 'active',
  neighborhood_id  bigint references public.neighborhoods(id) on delete set null,
  address          text check (char_length(address) <= 255),
  bio              text check (char_length(bio) <= 500),
  avatar_url       text,
  cover_url        text,
  date_of_birth    date,
  gender           public.gender_type,
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index profiles_neighborhood_idx on public.profiles(neighborhood_id);
create index profiles_role_idx on public.profiles(role);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Auth helpers (security definer so they can be used inside RLS policies
-- without recursing into the profiles policies)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin','moderator') and status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'active'
  );
$$;

-- Users may edit their own profile but never their own role / status.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- auth.uid() is null for the SQL editor / service role, which may change anything.
  if (select auth.uid()) is not null then
    if not public.is_admin() then
      new.role   := old.role;      -- residents can't change their own role/status
      new.status := old.status;
    elsif not exists (select 1 from public.profiles
                      where id = (select auth.uid()) and role = 'admin' and status = 'active') then
      new.role := old.role;        -- moderators can suspend/ban but not change roles
    end if;
  end if;
  new.id := old.id;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  base_username text;
  final_username text;
  n int := 0;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
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

  insert into public.profiles (id, full_name, username, phone, neighborhood_id)
  values (
    new.id,
    coalesce(nullif(meta->>'full_name',''), split_part(new.email, '@', 1), 'Neighbor'),
    final_username,
    nullif(meta->>'phone',''),
    nullif(meta->>'neighborhood_id','')::bigint
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. Post categories
-- ---------------------------------------------------------------------
create table public.post_categories (
  id    bigint generated always as identity primary key,
  name  text not null unique,
  icon  text
);

-- ---------------------------------------------------------------------
-- 4. Posts (feed). A share is a post whose shared_post_id points at
--    the original, exactly like Facebook.
-- ---------------------------------------------------------------------
create table public.posts (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  neighborhood_id  bigint references public.neighborhoods(id) on delete set null,
  category_id      bigint references public.post_categories(id) on delete set null,
  post_type        public.post_type not null default 'post',
  title            text check (char_length(title) <= 200),
  body             text not null default '' check (char_length(body) <= 5000),
  image_url        text,
  location_name    text check (char_length(location_name) <= 255),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  shared_post_id   bigint references public.posts(id) on delete set null,
  status           public.content_status not null default 'published',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint posts_not_empty check (
    char_length(trim(body)) > 0 or image_url is not null or shared_post_id is not null
  )
);
create index posts_feed_idx         on public.posts(status, created_at desc);
create index posts_user_idx         on public.posts(user_id);
create index posts_neighborhood_idx on public.posts(neighborhood_id);
create index posts_category_idx     on public.posts(category_id);
create index posts_shared_idx       on public.posts(shared_post_id);
create index posts_geo_idx          on public.posts(latitude, longitude) where latitude is not null;
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- Owners cannot un-hide something a moderator hid.
create or replace function public.protect_moderation_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() and old.status::text = 'hidden' then
    new.status := old.status;
  end if;
  return new;
end $$;
create trigger posts_protect_status before update on public.posts
  for each row execute function public.protect_moderation_status();

-- ---------------------------------------------------------------------
-- 5. Community events
-- ---------------------------------------------------------------------
create table public.events (
  id               bigint generated always as identity primary key,
  created_by       uuid not null references public.profiles(id) on delete cascade,
  neighborhood_id  bigint references public.neighborhoods(id) on delete set null,
  title            text not null check (char_length(title) between 2 and 200),
  description      text not null check (char_length(description) <= 5000),
  starts_at        timestamptz not null,
  ends_at          timestamptz,
  location         text not null check (char_length(location) <= 255),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  image_url        text,
  max_participants int check (max_participants is null or max_participants > 0),
  status           public.event_status not null default 'upcoming',
  created_at       timestamptz not null default now(),
  constraint events_dates check (ends_at is null or ends_at >= starts_at)
);
create index events_date_idx on public.events(starts_at, status);
create index events_creator_idx on public.events(created_by);

create table public.event_participants (
  event_id   bigint not null references public.events(id) on delete cascade,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  rsvp       public.rsvp_status not null default 'going',
  joined_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_participants_user_idx on public.event_participants(user_id);

-- ---------------------------------------------------------------------
-- 6. Help & support requests
-- ---------------------------------------------------------------------
create table public.help_requests (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  neighborhood_id  bigint references public.neighborhoods(id) on delete set null,
  help_type        public.help_type not null,
  title            text not null check (char_length(title) between 2 and 200),
  details          text not null check (char_length(details) <= 5000),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  status           public.help_status not null default 'open',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index help_status_idx on public.help_requests(status, created_at desc);
create index help_user_idx on public.help_requests(user_id);
create trigger help_updated_at before update on public.help_requests
  for each row execute function public.set_updated_at();

create table public.help_responses (
  id               bigint generated always as identity primary key,
  help_request_id  bigint not null references public.help_requests(id) on delete cascade,
  responder_id     uuid   not null references public.profiles(id) on delete cascade,
  message          text   not null check (char_length(message) between 1 and 2000),
  created_at       timestamptz not null default now()
);
create index help_responses_request_idx on public.help_responses(help_request_id);
create index help_responses_responder_idx on public.help_responses(responder_id);

-- ---------------------------------------------------------------------
-- 7. Local service directory
-- ---------------------------------------------------------------------
create table public.service_categories (
  id    bigint generated always as identity primary key,
  name  text not null unique,
  icon  text
);

create table public.services (
  id                   bigint generated always as identity primary key,
  provider_id          uuid   not null references public.profiles(id) on delete cascade,
  neighborhood_id      bigint references public.neighborhoods(id) on delete set null,
  service_category_id  bigint not null references public.service_categories(id),
  service_name         text   not null check (char_length(service_name) between 2 and 150),
  description          text   not null check (char_length(description) <= 3000),
  contact_phone        text   not null check (char_length(contact_phone) <= 20),
  contact_email        text,
  price_info           text   check (char_length(price_info) <= 100),
  image_url            text,
  latitude             double precision check (latitude between -90 and 90),
  longitude            double precision check (longitude between -180 and 180),
  is_verified          boolean not null default false,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now()
);
create index services_category_idx on public.services(service_category_id);
create index services_provider_idx on public.services(provider_id);
create index services_search_idx on public.services
  using gin (to_tsvector('simple', service_name || ' ' || description));

-- Only admins can mark a service verified.
create or replace function public.protect_service_verified()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    new.is_verified := case when tg_op = 'INSERT' then false else old.is_verified end;
  end if;
  return new;
end $$;
create trigger services_protect_verified before insert or update on public.services
  for each row execute function public.protect_service_verified();

-- ---------------------------------------------------------------------
-- 8. Buy / sell / exchange listings
-- ---------------------------------------------------------------------
create table public.marketplace_listings (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  neighborhood_id  bigint references public.neighborhoods(id) on delete set null,
  listing_type     public.listing_type not null default 'sell',
  title            text not null check (char_length(title) between 2 and 200),
  description      text not null check (char_length(description) <= 5000),
  category         text check (char_length(category) <= 60),
  item_condition   public.item_condition,
  price            numeric(12,2) check (price is null or price >= 0),
  image_url        text,
  contact_info     text check (char_length(contact_info) <= 120),
  location_name    text check (char_length(location_name) <= 255),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  status           public.listing_status not null default 'available',
  created_at       timestamptz not null default now()
);
create index listings_type_status_idx on public.marketplace_listings(listing_type, status, created_at desc);
create index listings_user_idx on public.marketplace_listings(user_id);

-- ---------------------------------------------------------------------
-- 9. Lost & found
-- ---------------------------------------------------------------------
create table public.lost_found_items (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  neighborhood_id  bigint references public.neighborhoods(id) on delete set null,
  report_type      public.lf_type not null,
  item_name        text not null check (char_length(item_name) between 2 and 150),
  description      text not null check (char_length(description) <= 3000),
  location         text not null check (char_length(location) <= 255),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  date_occurred    date,
  image_url        text,
  contact_info     text check (char_length(contact_info) <= 120),
  status           public.lf_status not null default 'open',
  created_at       timestamptz not null default now()
);
create index lf_type_status_idx on public.lost_found_items(report_type, status, created_at desc);
create index lf_user_idx on public.lost_found_items(user_id);

-- ---------------------------------------------------------------------
-- 10. Emergency alerts
-- ---------------------------------------------------------------------
create table public.emergency_alerts (
  id               bigint generated always as identity primary key,
  created_by       uuid not null references public.profiles(id) on delete cascade,
  neighborhood_id  bigint references public.neighborhoods(id) on delete set null,
  title            text not null check (char_length(title) between 2 and 200),
  message          text not null check (char_length(message) <= 3000),
  severity         public.alert_severity not null default 'medium',
  location_name    text check (char_length(location_name) <= 255),
  latitude         double precision check (latitude between -90 and 90),
  longitude        double precision check (longitude between -180 and 180),
  status           public.alert_status not null default 'active',
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index alerts_active_idx on public.emergency_alerts(status, created_at desc);
create index alerts_creator_idx on public.emergency_alerts(created_by);

-- ---------------------------------------------------------------------
-- 11. Comments — exactly one target per comment (same rule as MySQL),
--     plus parent_id for Facebook-style replies.
-- ---------------------------------------------------------------------
create table public.comments (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  post_id          bigint references public.posts(id) on delete cascade,
  event_id         bigint references public.events(id) on delete cascade,
  help_request_id  bigint references public.help_requests(id) on delete cascade,
  listing_id       bigint references public.marketplace_listings(id) on delete cascade,
  lost_found_id    bigint references public.lost_found_items(id) on delete cascade,
  parent_id        bigint references public.comments(id) on delete cascade,
  content          text not null check (char_length(content) between 1 and 2000),
  status           public.comment_status not null default 'visible',
  created_at       timestamptz not null default now(),
  constraint comments_one_target check (
    num_nonnulls(post_id, event_id, help_request_id, listing_id, lost_found_id) = 1
  )
);
create index comments_post_idx    on public.comments(post_id, created_at);
create index comments_event_idx   on public.comments(event_id);
create index comments_help_idx    on public.comments(help_request_id);
create index comments_listing_idx on public.comments(listing_id);
create index comments_lf_idx      on public.comments(lost_found_id);
create index comments_parent_idx  on public.comments(parent_id);
create index comments_user_idx    on public.comments(user_id);
create trigger comments_protect_status before update on public.comments
  for each row execute function public.protect_moderation_status();

-- ---------------------------------------------------------------------
-- 12. Reactions — one per user per target
-- ---------------------------------------------------------------------
create table public.reactions (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  post_id        bigint references public.posts(id) on delete cascade,
  event_id       bigint references public.events(id) on delete cascade,
  comment_id     bigint references public.comments(id) on delete cascade,
  reaction_type  public.reaction_type not null default 'like',
  created_at     timestamptz not null default now(),
  constraint reactions_one_target check (num_nonnulls(post_id, event_id, comment_id) = 1),
  constraint reactions_user_post_uq    unique (user_id, post_id),
  constraint reactions_user_event_uq   unique (user_id, event_id),
  constraint reactions_user_comment_uq unique (user_id, comment_id)
);
create index reactions_post_idx    on public.reactions(post_id);
create index reactions_event_idx   on public.reactions(event_id);
create index reactions_comment_idx on public.reactions(comment_id);

-- ---------------------------------------------------------------------
-- 13. Direct messages
-- ---------------------------------------------------------------------
create table public.conversations (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id  bigint not null references public.conversations(id) on delete cascade,
  user_id          uuid   not null references public.profiles(id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id);

create table public.messages (
  id               bigint generated always as identity primary key,
  conversation_id  bigint not null references public.conversations(id) on delete cascade,
  sender_id        uuid   not null references public.profiles(id) on delete cascade,
  body             text   not null check (char_length(body) between 1 and 4000),
  created_at       timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index messages_sender_idx on public.messages(sender_id);

create or replace function public.is_conversation_member(cid bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = cid and user_id = (select auth.uid())
  );
$$;

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;
create trigger messages_touch after insert on public.messages
  for each row execute function public.touch_conversation();

-- Find or create the 1:1 conversation between the caller and another user.
create or replace function public.start_conversation(other_user uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid bigint;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if other_user is null or other_user = me then raise exception 'Pick another neighbor'; end if;
  if not public.is_active_user() then raise exception 'Your account is not active'; end if;
  if not exists (select 1 from public.profiles where id = other_user) then
    raise exception 'User not found';
  end if;

  select a.conversation_id into cid
  from public.conversation_members a
  join public.conversation_members b on b.conversation_id = a.conversation_id
  where a.user_id = me and b.user_id = other_user
    and (select count(*) from public.conversation_members c where c.conversation_id = a.conversation_id) = 2
  limit 1;

  if cid is null then
    insert into public.conversations default values returning id into cid;
    insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, other_user);
  end if;
  return cid;
end $$;

-- Inbox list for the caller.
create or replace function public.my_conversations()
returns table (
  conversation_id bigint,
  other_user_id uuid,
  other_name text,
  other_username text,
  other_avatar text,
  last_message text,
  last_sender_id uuid,
  last_message_at timestamptz,
  unread_count bigint
) language sql stable security definer set search_path = '' as $$
  select
    c.id,
    o.user_id,
    p.full_name,
    p.username,
    p.avatar_url,
    lm.body,
    lm.sender_id,
    c.last_message_at,
    (select count(*) from public.messages m
      where m.conversation_id = c.id and m.sender_id <> (select auth.uid())
        and m.created_at > me.last_read_at)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  left join lateral (
    select m.body, m.sender_id from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = (select auth.uid())
  order by c.last_message_at desc;
$$;

-- ---------------------------------------------------------------------
-- 14. Notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  actor_id      uuid references public.profiles(id) on delete set null,
  type          public.notification_type not null,
  message       text not null check (char_length(message) <= 255),
  link          text,
  reference_id  bigint,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, is_read, created_at desc);
create index notifications_actor_idx on public.notifications(actor_id);

-- ---------------------------------------------------------------------
-- 15. Reports & moderation
-- ---------------------------------------------------------------------
create table public.reports (
  id            bigint generated always as identity primary key,
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  target_type   public.report_target not null,
  target_id     text not null,
  reason        public.report_reason not null,
  details       text check (char_length(details) <= 2000),
  status        public.report_status not null default 'pending',
  reviewed_by   uuid references public.profiles(id) on delete set null,
  action_taken  public.report_action not null default 'none',
  admin_note    text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);
create index reports_status_idx on public.reports(status, created_at desc);
create index reports_target_idx on public.reports(target_type, target_id);
create index reports_reporter_idx on public.reports(reporter_id);
create index reports_reviewer_idx on public.reports(reviewed_by);

-- =====================================================================
--  Notification triggers (likes, comments, shares, alerts, help, RSVPs)
-- =====================================================================
create or replace function public.notify(
  target uuid, actor uuid, ntype public.notification_type, msg text, lnk text, ref bigint
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if target is null or target = actor then return; end if;
  insert into public.notifications (user_id, actor_id, type, message, link, reference_id)
  values (target, actor, ntype, left(msg, 255), lnk, ref);
end $$;

create or replace function public.actor_name(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select full_name from public.profiles where id = uid), 'Someone');
$$;

create or replace function public.on_reaction_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.post_id is not null then
    perform public.notify(
      (select user_id from public.posts where id = new.post_id), new.user_id, 'reaction',
      public.actor_name(new.user_id) || ' reacted to your post', '/post/' || new.post_id, new.post_id);
  elsif new.comment_id is not null then
    perform public.notify(
      (select user_id from public.comments where id = new.comment_id), new.user_id, 'reaction',
      public.actor_name(new.user_id) || ' liked your comment',
      (select '/post/' || post_id from public.comments where id = new.comment_id), new.comment_id);
  end if;
  return new;
end $$;
create trigger reactions_notify after insert on public.reactions
  for each row execute function public.on_reaction_created();

create or replace function public.on_comment_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
  lnk text;
  what text;
begin
  if new.parent_id is not null then
    perform public.notify((select user_id from public.comments where id = new.parent_id), new.user_id,
      'comment', public.actor_name(new.user_id) || ' replied to your comment',
      case when new.post_id is not null then '/post/' || new.post_id end, new.parent_id);
  end if;

  if new.post_id is not null then
    select user_id into owner from public.posts where id = new.post_id;
    lnk := '/post/' || new.post_id; what := 'your post';
  elsif new.listing_id is not null then
    select user_id into owner from public.marketplace_listings where id = new.listing_id;
    lnk := '/marketplace?item=' || new.listing_id; what := 'your listing';
  elsif new.lost_found_id is not null then
    select user_id into owner from public.lost_found_items where id = new.lost_found_id;
    lnk := '/lost-found?item=' || new.lost_found_id; what := 'your lost & found report';
  elsif new.event_id is not null then
    select created_by into owner from public.events where id = new.event_id;
    lnk := '/events?item=' || new.event_id; what := 'your event';
  elsif new.help_request_id is not null then
    select user_id into owner from public.help_requests where id = new.help_request_id;
    lnk := '/services?tab=help&item=' || new.help_request_id; what := 'your help request';
  end if;

  perform public.notify(owner, new.user_id, 'comment',
    public.actor_name(new.user_id) || ' commented on ' || what, lnk, new.id);
  return new;
end $$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.on_comment_created();

create or replace function public.on_post_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.shared_post_id is not null then
    perform public.notify((select user_id from public.posts where id = new.shared_post_id), new.user_id,
      'share', public.actor_name(new.user_id) || ' shared your post', '/post/' || new.id, new.id);
  end if;
  return new;
end $$;
create trigger posts_notify after insert on public.posts
  for each row execute function public.on_post_created();

create or replace function public.on_alert_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, actor_id, type, message, link, reference_id)
  select p.id, new.created_by, 'emergency',
         left('🚨 ' || upper(new.severity::text) || ': ' || new.title, 255), '/alerts', new.id
  from public.profiles p
  where p.status = 'active' and p.id <> new.created_by
    and (new.neighborhood_id is null or p.neighborhood_id = new.neighborhood_id or p.neighborhood_id is null);
  return new;
end $$;
create trigger alerts_notify after insert on public.emergency_alerts
  for each row execute function public.on_alert_created();

create or replace function public.on_help_response_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify((select user_id from public.help_requests where id = new.help_request_id),
    new.responder_id, 'help_request', public.actor_name(new.responder_id) || ' offered to help you',
    '/services?tab=help&item=' || new.help_request_id, new.help_request_id);
  return new;
end $$;
create trigger help_responses_notify after insert on public.help_responses
  for each row execute function public.on_help_response_created();

create or replace function public.on_rsvp_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify((select created_by from public.events where id = new.event_id), new.user_id,
    'event', public.actor_name(new.user_id) ||
      case when new.rsvp = 'going' then ' is going to your event' else ' is interested in your event' end,
    '/events?item=' || new.event_id, new.event_id);
  return new;
end $$;
create trigger rsvp_notify after insert on public.event_participants
  for each row execute function public.on_rsvp_created();

-- =====================================================================
--  Views (security_invoker = true, so RLS of the caller applies)
-- =====================================================================
create view public.feed_posts with (security_invoker = true) as
select
  p.id, p.user_id, p.neighborhood_id, p.category_id, p.post_type, p.title, p.body, p.image_url,
  p.location_name, p.latitude, p.longitude, p.shared_post_id, p.status, p.created_at, p.updated_at,
  pr.full_name  as author_name,
  pr.username   as author_username,
  pr.avatar_url as author_avatar,
  pr.role       as author_role,
  n.name        as neighborhood_name,
  c.name        as category_name,
  (select count(*) from public.reactions r where r.post_id = p.id)::int as reaction_count,
  (select count(*) from public.comments cm where cm.post_id = p.id and cm.status = 'visible')::int as comment_count,
  (select count(*) from public.posts s where s.shared_post_id = p.id and s.status = 'published')::int as share_count,
  (select r.reaction_type from public.reactions r
     where r.post_id = p.id and r.user_id = (select auth.uid())) as my_reaction,
  array(select r.reaction_type from public.reactions r where r.post_id = p.id
        group by r.reaction_type order by count(*) desc limit 3) as top_reactions,
  case when sp.id is not null then jsonb_build_object(
    'id', sp.id, 'title', sp.title, 'body', sp.body, 'image_url', sp.image_url,
    'created_at', sp.created_at, 'user_id', sp.user_id, 'status', sp.status,
    'author_name', spr.full_name, 'author_avatar', spr.avatar_url, 'author_username', spr.username,
    'location_name', sp.location_name
  ) end as shared_post
from public.posts p
join public.profiles pr on pr.id = p.user_id
left join public.neighborhoods n on n.id = p.neighborhood_id
left join public.post_categories c on c.id = p.category_id
left join public.posts sp on sp.id = p.shared_post_id
left join public.profiles spr on spr.id = sp.user_id;

-- Everything that has coordinates, for the Map page.
create view public.map_items with (security_invoker = true) as
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
    from public.services where latitude is not null and is_active;

-- =====================================================================
--  Admin RPCs
-- =====================================================================
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select jsonb_build_object(
    'users',            (select count(*) from public.profiles),
    'active_users',     (select count(*) from public.profiles where status = 'active'),
    'banned_users',     (select count(*) from public.profiles where status <> 'active'),
    'posts',            (select count(*) from public.posts),
    'hidden_posts',     (select count(*) from public.posts where status = 'hidden'),
    'comments',         (select count(*) from public.comments),
    'reactions',        (select count(*) from public.reactions),
    'shares',           (select count(*) from public.posts where shared_post_id is not null),
    'listings',         (select count(*) from public.marketplace_listings),
    'lost_found',       (select count(*) from public.lost_found_items),
    'events',           (select count(*) from public.events),
    'services',         (select count(*) from public.services),
    'help_requests',    (select count(*) from public.help_requests),
    'alerts_active',    (select count(*) from public.emergency_alerts where status = 'active'),
    'messages',         (select count(*) from public.messages),
    'reports_pending',  (select count(*) from public.reports where status in ('pending','under_review')),
    'neighborhoods',    (select count(*) from public.neighborhoods),
    'posts_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'posts', coalesce(x.cnt, 0)) order by d), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') d
      left join (select created_at::date as day, count(*) cnt from public.posts
                 where created_at >= current_date - 13 group by 1) x on x.day = d::date
    ),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'users', coalesce(x.cnt, 0)) order by d), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') d
      left join (select created_at::date as day, count(*) cnt from public.profiles
                 where created_at >= current_date - 13 group by 1) x on x.day = d::date
    ),
    'users_by_neighborhood', (
      select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(n.name, 'Not set'), 'users', t.cnt) order by t.cnt desc), '[]'::jsonb)
      from (select neighborhood_id, count(*) cnt from public.profiles group by 1) t
      left join public.neighborhoods n on n.id = t.neighborhood_id
    )
  ) into result;
  return result;
end $$;

-- Admin user list with email + last sign-in from auth.users (emails are not
-- exposed anywhere else).
create or replace function public.admin_users()
returns table (
  id uuid, full_name text, username text, email text, phone text,
  role public.user_role, status public.user_status, neighborhood_id bigint,
  neighborhood_name text, avatar_url text, created_at timestamptz,
  last_sign_in_at timestamptz, post_count bigint, report_count bigint
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select p.id, p.full_name, p.username, u.email::text, p.phone, p.role, p.status, p.neighborhood_id,
         n.name, p.avatar_url, p.created_at, u.last_sign_in_at,
         (select count(*) from public.posts x where x.user_id = p.id),
         (select count(*) from public.reports r where r.target_type = 'user' and r.target_id = p.id::text)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.neighborhoods n on n.id = p.neighborhood_id
  order by p.created_at desc;
end $$;

-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.neighborhoods        enable row level security;
alter table public.profiles             enable row level security;
alter table public.post_categories      enable row level security;
alter table public.posts                enable row level security;
alter table public.events               enable row level security;
alter table public.event_participants   enable row level security;
alter table public.help_requests        enable row level security;
alter table public.help_responses       enable row level security;
alter table public.service_categories   enable row level security;
alter table public.services             enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.lost_found_items     enable row level security;
alter table public.emergency_alerts     enable row level security;
alter table public.comments             enable row level security;
alter table public.reactions            enable row level security;
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;
alter table public.notifications        enable row level security;
alter table public.reports              enable row level security;

-- Lookup tables: everyone (even signed-out, for the sign-up form) can read; admins manage.
create policy "neighborhoods readable" on public.neighborhoods for select to anon, authenticated using (true);
create policy "neighborhoods admin insert" on public.neighborhoods for insert to authenticated with check ((select public.is_admin()));
create policy "neighborhoods admin update" on public.neighborhoods for update to authenticated using ((select public.is_admin()));
create policy "neighborhoods admin delete" on public.neighborhoods for delete to authenticated using ((select public.is_admin()));

create policy "post categories readable" on public.post_categories for select to anon, authenticated using (true);
create policy "post categories admin insert" on public.post_categories for insert to authenticated with check ((select public.is_admin()));
create policy "post categories admin update" on public.post_categories for update to authenticated using ((select public.is_admin()));
create policy "post categories admin delete" on public.post_categories for delete to authenticated using ((select public.is_admin()));

create policy "service categories readable" on public.service_categories for select to anon, authenticated using (true);
create policy "service categories admin insert" on public.service_categories for insert to authenticated with check ((select public.is_admin()));
create policy "service categories admin update" on public.service_categories for update to authenticated using ((select public.is_admin()));
create policy "service categories admin delete" on public.service_categories for delete to authenticated using ((select public.is_admin()));

-- Profiles
create policy "profiles readable by members" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles admin delete" on public.profiles for delete to authenticated using ((select public.is_admin()));

-- Posts
create policy "posts readable" on public.posts for select to authenticated
  using (status = 'published' or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "posts insert own" on public.posts for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user())
              and (post_type = 'post' or (select public.is_admin())));
create policy "posts update own or admin" on public.posts for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "posts delete own or admin" on public.posts for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Comments
create policy "comments readable" on public.comments for select to authenticated
  using (status = 'visible' or user_id = (select auth.uid()) or (select public.is_admin()));
create policy "comments insert own" on public.comments for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy "comments update own or admin" on public.comments for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "comments delete own or admin" on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Reactions
create policy "reactions readable" on public.reactions for select to authenticated using (true);
create policy "reactions insert own" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy "reactions update own" on public.reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reactions delete own or admin" on public.reactions for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Generic owner-managed content (events, help, services, listings, lost & found, alerts)
create policy "events readable" on public.events for select to authenticated using (true);
create policy "events insert own" on public.events for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_active_user()));
create policy "events update own or admin" on public.events for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));
create policy "events delete own or admin" on public.events for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

create policy "rsvps readable" on public.event_participants for select to authenticated using (true);
create policy "rsvps insert own" on public.event_participants for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy "rsvps update own" on public.event_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "rsvps delete own or admin" on public.event_participants for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "help readable" on public.help_requests for select to authenticated using (true);
create policy "help insert own" on public.help_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy "help update own or admin" on public.help_requests for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "help delete own or admin" on public.help_requests for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "help responses readable" on public.help_responses for select to authenticated using (true);
create policy "help responses insert own" on public.help_responses for insert to authenticated
  with check (responder_id = (select auth.uid()) and (select public.is_active_user()));
create policy "help responses delete own or admin" on public.help_responses for delete to authenticated
  using (responder_id = (select auth.uid()) or (select public.is_admin()));

create policy "services readable" on public.services for select to authenticated
  using (is_active or provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "services insert own" on public.services for insert to authenticated
  with check (provider_id = (select auth.uid()) and (select public.is_active_user()));
create policy "services update own or admin" on public.services for update to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()))
  with check (provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "services delete own or admin" on public.services for delete to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()));

create policy "listings readable" on public.marketplace_listings for select to authenticated using (true);
create policy "listings insert own" on public.marketplace_listings for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy "listings update own or admin" on public.marketplace_listings for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "listings delete own or admin" on public.marketplace_listings for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "lost found readable" on public.lost_found_items for select to authenticated using (true);
create policy "lost found insert own" on public.lost_found_items for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy "lost found update own or admin" on public.lost_found_items for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "lost found delete own or admin" on public.lost_found_items for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "alerts readable" on public.emergency_alerts for select to authenticated using (true);
create policy "alerts insert own" on public.emergency_alerts for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_active_user()));
create policy "alerts update own or admin" on public.emergency_alerts for update to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()))
  with check (created_by = (select auth.uid()) or (select public.is_admin()));
create policy "alerts delete own or admin" on public.emergency_alerts for delete to authenticated
  using (created_by = (select auth.uid()) or (select public.is_admin()));

-- Messages: members only. Conversations are created through start_conversation().
create policy "conversations members read" on public.conversations for select to authenticated
  using ((select public.is_conversation_member(id)));
create policy "members read" on public.conversation_members for select to authenticated
  using ((select public.is_conversation_member(conversation_id)));
create policy "members mark read" on public.conversation_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "messages members read" on public.messages for select to authenticated
  using ((select public.is_conversation_member(conversation_id)));
create policy "messages members send" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select public.is_active_user())
              and (select public.is_conversation_member(conversation_id)));
create policy "messages delete own" on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Notifications: your own only. Created by triggers; admins may send system notices.
create policy "notifications own read" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications admin insert" on public.notifications for insert to authenticated
  with check ((select public.is_admin()));
create policy "notifications own update" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications own delete" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Reports: anyone can file; reporter sees own; admins see and resolve all.
create policy "reports insert own" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'pending' and reviewed_by is null);
create policy "reports read own or admin" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy "reports admin update" on public.reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "reports admin delete" on public.reports for delete to authenticated
  using ((select public.is_admin()));

-- RPC access
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.start_conversation(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.notify(uuid, uuid, public.notification_type, text, text, bigint) from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;

-- Realtime for chat + notifications
alter publication supabase_realtime add table public.messages, public.notifications;
