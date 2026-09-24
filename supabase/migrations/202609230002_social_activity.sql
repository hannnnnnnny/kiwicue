create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id text not null check (event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_event_page on public.comments (event_id, created_at desc, id);
create index comments_parent on public.comments (parent_id, created_at, id);
create index comments_user on public.comments (user_id, created_at desc);
create trigger comments_updated before update on public.comments
for each row execute function public.touch_updated_at();

create function public.check_comment_reply() returns trigger
language plpgsql set search_path = '' as $$
declare parent_event text;
declare grandparent uuid;
begin
  if new.parent_id is null then return new; end if;
  select event_id, parent_id into parent_event, grandparent
  from public.comments where id = new.parent_id and deleted_at is null;
  if parent_event is null or parent_event <> new.event_id or grandparent is not null then
    raise exception 'Replies must belong to a top-level comment on the same event';
  end if;
  return new;
end;
$$;
create trigger comments_reply_depth before insert on public.comments
for each row execute function public.check_comment_reply();

create table public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index comment_likes_user on public.comment_likes (user_id, created_at desc);

create table public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'offensive', 'misinformation', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (comment_id, reporter_id)
);

create table public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following on public.user_follows (following_id, created_at desc);

create table public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text check (event_id is null or event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  action text not null check (action in (
    'event_view', 'event_save', 'event_unsave', 'event_interested', 'event_going',
    'event_went', 'event_share', 'event_comment', 'event_like', 'event_ticket_click',
    'search', 'filter_apply')),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 2048),
  created_at timestamptz not null default now()
);
create index activity_user_recent on public.user_activity (user_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('comment_reply', 'comment_like', 'new_follower',
    'saved_event_reminder', 'event_update', 'recommendation')),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) <= 500),
  url text not null check (url ~ '^/[A-Za-z0-9_/?&=-]*$' and url !~ '^//'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_unread on public.notifications (user_id, created_at desc)
where read_at is null;
create index notifications_recent on public.notifications (user_id, created_at desc);

alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_reports enable row level security;
alter table public.user_follows enable row level security;
alter table public.user_activity enable row level security;
alter table public.notifications enable row level security;

revoke all on public.comments, public.comment_likes, public.comment_reports,
  public.user_follows, public.user_activity, public.notifications from anon, authenticated;
grant select on public.comments, public.comment_likes, public.user_follows to anon;
grant select on public.comments, public.comment_likes, public.user_follows,
  public.user_activity, public.notifications to authenticated;
grant insert on public.comments, public.comment_likes, public.comment_reports,
  public.user_follows, public.user_activity to authenticated;
grant update (content, deleted_at) on public.comments to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.comment_likes, public.user_follows to authenticated;

create policy comments_read on public.comments for select to anon, authenticated
using (deleted_at is null or user_id = (select auth.uid()));
create policy comments_insert on public.comments for insert to authenticated
with check (user_id = (select auth.uid()) and deleted_at is null);
create policy comments_update on public.comments for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy likes_read on public.comment_likes for select to anon, authenticated
using (exists (select 1 from public.comments c where c.id = comment_id and c.deleted_at is null));
create policy likes_insert on public.comment_likes for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.comments c where c.id = comment_id and c.deleted_at is null));
create policy likes_delete on public.comment_likes for delete to authenticated
using (user_id = (select auth.uid()));
create policy reports_insert on public.comment_reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and status = 'pending'
  and reviewed_at is null and exists (
    select 1 from public.comments c where c.id = comment_id and c.deleted_at is null));
create policy follows_read on public.user_follows for select to anon, authenticated
using (follower_id = (select auth.uid()) or following_id = (select auth.uid())
  or exists (select 1 from public.profiles p where p.id = following_id and p.is_public));
create policy follows_insert on public.user_follows for insert to authenticated
with check (follower_id = (select auth.uid()) and follower_id <> following_id
  and exists (select 1 from public.profiles p where p.id = following_id and p.is_public));
create policy follows_delete on public.user_follows for delete to authenticated
using (follower_id = (select auth.uid()));
create policy activity_own on public.user_activity for select to authenticated
using (user_id = (select auth.uid()));
create policy activity_insert on public.user_activity for insert to authenticated
with check (user_id = (select auth.uid()));
create policy notifications_own on public.notifications for select to authenticated
using (user_id = (select auth.uid()));
create policy notifications_read on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function public.notify_on_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.notification_preferences
    where user_id = new.following_id and new_followers) then
    insert into public.notifications (user_id, type, title, body, url)
    values (new.following_id, 'new_follower', 'New follower',
      'Someone followed your profile.', '/account');
  end if;
  return new;
end;
$$;
create trigger user_follow_notification after insert on public.user_follows
for each row execute function public.notify_on_follow();

create function public.notify_on_comment_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  if new.parent_id is null then return new; end if;
  select user_id into recipient from public.comments where id = new.parent_id;
  if recipient is not null and recipient <> new.user_id and exists (
    select 1 from public.notification_preferences where user_id = recipient and comment_replies) then
    insert into public.notifications (user_id, type, title, body, url)
    values (recipient, 'comment_reply', 'New reply',
      'Someone replied to your comment.', '/events/' || new.event_id);
  end if;
  return new;
end;
$$;
create trigger comment_reply_notification after insert on public.comments
for each row execute function public.notify_on_comment_reply();

create function public.notify_on_comment_like() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
declare target_event text;
begin
  select user_id, event_id into recipient, target_event from public.comments where id = new.comment_id;
  if recipient is not null and recipient <> new.user_id and exists (
    select 1 from public.notification_preferences where user_id = recipient and comment_likes) then
    insert into public.notifications (user_id, type, title, body, url)
    values (recipient, 'comment_like', 'Comment liked',
      'Someone liked your comment.', '/events/' || target_event);
  end if;
  return new;
end;
$$;
create trigger comment_like_notification after insert on public.comment_likes
for each row execute function public.notify_on_comment_like();

revoke execute on function public.create_user_profile(), public.notify_on_follow(),
  public.notify_on_comment_reply(), public.notify_on_comment_like() from public, anon, authenticated;
