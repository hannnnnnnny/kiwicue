create extension if not exists pgcrypto;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 100),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  bio text check (bio is null or char_length(bio) <= 500),
  city text check (city is null or char_length(city) <= 100),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_saved boolean not null default false,
  show_going boolean not null default false,
  followers_can_see_activity boolean not null default false,
  default_collections_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  comment_replies boolean not null default true,
  comment_likes boolean not null default true,
  new_followers boolean not null default true,
  saved_event_reminders boolean not null default false,
  event_updates boolean not null default false,
  recommendations boolean not null default false,
  updated_at timestamptz not null default now()
);

create function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, 'user_' || left(replace(new.id::text, '-', ''), 25), 'KiwiCue member');
  insert into public.privacy_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_user_profile();

create trigger profiles_updated before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger privacy_updated before update on public.privacy_settings
for each row execute function public.touch_updated_at();
create trigger notifications_preferences_updated before update on public.notification_preferences
for each row execute function public.touch_updated_at();

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 80)
);

insert into public.interests (slug, name) values
('ai', 'AI'), ('tech', 'Tech'), ('startups', 'Startups'),
('live-music', 'Live Music'), ('food', 'Food'), ('nightlife', 'Nightlife'),
('art', 'Art'), ('movies', 'Movies'), ('comedy', 'Comedy'),
('markets', 'Markets'), ('family', 'Family'), ('sports', 'Sports'),
('networking', 'Networking'), ('workshops', 'Workshops'), ('exhibitions', 'Exhibitions');

create table public.user_interests (
  user_id uuid not null references auth.users(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  weight smallint not null default 1 check (weight between 1 and 5),
  source text not null default 'selected' check (source in ('selected', 'behaviour')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, interest_id)
);
create trigger user_interests_updated before update on public.user_interests
for each row execute function public.touch_updated_at();

create table public.saved_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  event_snapshot jsonb not null check (
    octet_length(event_snapshot::text) <= 50000
    and event_snapshot->>'id' = event_id
    and event_snapshot->>'url' ~ '^https://'
    and char_length(event_snapshot->>'name') between 1 and 300),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index saved_events_user_created on public.saved_events (user_id, created_at desc);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_owner on public.collections (user_id, created_at desc);
create trigger collections_updated before update on public.collections
for each row execute function public.touch_updated_at();

create table public.collection_events (
  collection_id uuid not null references public.collections(id) on delete cascade,
  event_id text not null check (event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  event_snapshot jsonb not null check (
    octet_length(event_snapshot::text) <= 50000
    and event_snapshot->>'id' = event_id
    and event_snapshot->>'url' ~ '^https://'
    and char_length(event_snapshot->>'name') between 1 and 300),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (collection_id, event_id)
);
create index collection_events_order on public.collection_events (collection_id, position, created_at);

create table public.event_user_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  status text not null check (status in ('interested', 'going', 'went')),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index event_user_status_event on public.event_user_status (event_id, status);
create trigger event_status_updated before update on public.event_user_status
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.interests enable row level security;
alter table public.user_interests enable row level security;
alter table public.saved_events enable row level security;
alter table public.collections enable row level security;
alter table public.collection_events enable row level security;
alter table public.event_user_status enable row level security;

revoke all on public.profiles, public.privacy_settings, public.notification_preferences,
  public.interests, public.user_interests, public.saved_events, public.collections,
  public.collection_events, public.event_user_status from anon, authenticated;
grant select on public.profiles, public.interests, public.collections,
  public.collection_events to anon;
grant select on public.profiles, public.privacy_settings, public.notification_preferences,
  public.interests, public.user_interests, public.saved_events, public.collections,
  public.collection_events, public.event_user_status to authenticated;
grant update (username, display_name, avatar_url, bio, city, is_public) on public.profiles to authenticated;
grant update (show_saved, show_going, followers_can_see_activity, default_collections_public)
  on public.privacy_settings to authenticated;
grant update (comment_replies, comment_likes, new_followers, saved_event_reminders,
  event_updates, recommendations) on public.notification_preferences to authenticated;
grant insert, update, delete on public.user_interests, public.saved_events,
  public.collections, public.collection_events, public.event_user_status to authenticated;

create policy profiles_read on public.profiles for select to anon, authenticated
using (is_public or id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy privacy_own on public.privacy_settings for select to authenticated
using (user_id = (select auth.uid()));
create policy privacy_update on public.privacy_settings for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notification_preferences_own on public.notification_preferences for select to authenticated
using (user_id = (select auth.uid()));
create policy notification_preferences_update on public.notification_preferences for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy interests_read on public.interests for select to anon, authenticated using (true);
create policy user_interests_own on public.user_interests for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_own on public.saved_events for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy collections_read on public.collections for select to anon, authenticated
using (is_public or user_id = (select auth.uid()));
create policy collections_insert on public.collections for insert to authenticated
with check (user_id = (select auth.uid()));
create policy collections_update on public.collections for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy collections_delete on public.collections for delete to authenticated
using (user_id = (select auth.uid()));
create policy collection_events_read on public.collection_events for select to anon, authenticated
using (exists (select 1 from public.collections c where c.id = collection_id
  and (c.is_public or c.user_id = (select auth.uid()))));
create policy collection_events_insert on public.collection_events for insert to authenticated
with check (exists (select 1 from public.collections c where c.id = collection_id
  and c.user_id = (select auth.uid())));
create policy collection_events_update on public.collection_events for update to authenticated
using (exists (select 1 from public.collections c where c.id = collection_id
  and c.user_id = (select auth.uid())))
with check (exists (select 1 from public.collections c where c.id = collection_id
  and c.user_id = (select auth.uid())));
create policy collection_events_delete on public.collection_events for delete to authenticated
using (exists (select 1 from public.collections c where c.id = collection_id
  and c.user_id = (select auth.uid())));
create policy event_status_own on public.event_user_status for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
