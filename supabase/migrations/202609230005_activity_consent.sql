alter table public.privacy_settings
add column allow_activity_tracking boolean not null default false;

grant update (allow_activity_tracking) on public.privacy_settings to authenticated;

create function public.activity_consent_required() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.privacy_settings
    where user_id = new.user_id and allow_activity_tracking) then
    raise exception 'Activity recording requires consent' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger user_activity_consent before insert on public.user_activity
for each row execute function public.activity_consent_required();

revoke execute on function public.activity_consent_required() from public, anon, authenticated;

create function public.clear_activity_on_opt_out() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.allow_activity_tracking and not new.allow_activity_tracking then
    delete from public.user_activity where user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger activity_opt_out after update of allow_activity_tracking on public.privacy_settings
for each row execute function public.clear_activity_on_opt_out();

revoke execute on function public.clear_activity_on_opt_out() from public, anon, authenticated;
