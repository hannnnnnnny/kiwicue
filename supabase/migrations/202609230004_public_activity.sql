create function public.can_see_saved(owner_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.privacy_settings settings on settings.user_id = p.id
    where p.id = owner_id and p.is_public and (
      settings.show_saved or (settings.followers_can_see_activity and exists (
        select 1 from public.user_follows f
        where f.following_id = owner_id and f.follower_id = (select auth.uid())
      ))
    )
  );
$$;

create function public.can_see_going(owner_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    join public.privacy_settings settings on settings.user_id = p.id
    where p.id = owner_id and p.is_public and (
      settings.show_going or (settings.followers_can_see_activity and exists (
        select 1 from public.user_follows f
        where f.following_id = owner_id and f.follower_id = (select auth.uid())
      ))
    )
  );
$$;

grant execute on function public.can_see_saved(uuid), public.can_see_going(uuid)
to anon, authenticated;
grant select on public.saved_events, public.event_user_status to anon;

create policy saved_visible_by_choice on public.saved_events for select to anon, authenticated
using (public.can_see_saved(user_id));
create policy going_visible_by_choice on public.event_user_status for select to anon, authenticated
using (status in ('going', 'went') and public.can_see_going(user_id));
