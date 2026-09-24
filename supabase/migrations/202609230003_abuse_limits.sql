create function public.limit_comment_posts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.comments where user_id = new.user_id
      and created_at > now() - interval '1 minute') >= 5
    or (select count(*) from public.comments where user_id = new.user_id
      and created_at > now() - interval '1 day') >= 50 then
    raise exception 'Comment rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger comments_rate_limit before insert on public.comments
for each row execute function public.limit_comment_posts();

create function public.limit_comment_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.comment_reports where reporter_id = new.reporter_id
      and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Report rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger reports_rate_limit before insert on public.comment_reports
for each row execute function public.limit_comment_reports();

create function public.limit_follows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.user_follows where follower_id = new.follower_id
      and created_at > now() - interval '1 day') >= 100 then
    raise exception 'Follow rate limit exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger follows_rate_limit before insert on public.user_follows
for each row execute function public.limit_follows();

revoke execute on function public.limit_comment_posts(), public.limit_comment_reports(),
  public.limit_follows() from public, anon, authenticated;
