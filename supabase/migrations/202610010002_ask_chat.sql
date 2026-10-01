-- Kiwi chat: chat turns are metered separately from searches. Free quotas keep counting
-- searches; chat turns get their own daily cap and share the per-minute burst limit and the
-- global budget. The old three-argument ask_reserve calls keep working through p_kind's default.
alter table public.ask_usage
  add column kind text not null default 'search' check (kind in ('search', 'chat'));
alter table public.ask_limits
  add column chat_per_day integer not null default 60 check (chat_per_day >= 0);
-- A full conversation (6 turns) plus its search must fit inside one minute.
update public.ask_limits set per_minute = 20;
create index ask_usage_subject_kind_created on public.ask_usage (subject, kind, created_at desc);

drop function public.ask_reserve(text, text, uuid);

create function public.ask_reserve(p_subject text, p_tier text, p_user uuid, p_kind text default 'search')
returns table (allowed boolean, reason text, usage_id uuid, remaining integer, degrade boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_limits public.ask_limits%rowtype;
  v_settings public.ask_settings%rowtype;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';
  v_minute integer; v_searches integer; v_chats integer; v_day_spend bigint; v_month_spend bigint;
  v_day_cap numeric; v_month_cap numeric; v_degrade boolean; v_id uuid; v_left integer;
begin
  if p_kind not in ('search', 'chat') then return query select false, 'invalid_kind', null::uuid, 0, false; return; end if;
  -- Serialise requests from one subject so two tabs cannot both take the last free ask.
  perform pg_advisory_xact_lock(hashtext(p_subject));
  select * into v_limits from public.ask_limits l where l.tier = p_tier;
  if not found then return query select false, 'invalid_tier', null::uuid, 0, false; return; end if;
  select * into v_settings from public.ask_settings s where s.id = 1;
  delete from public.ask_usage u where u.created_at < now() - interval '40 days';

  select count(*) filter (where u.created_at > now() - interval '1 minute'),
         count(*) filter (where u.created_at >= v_day_start and u.kind = 'search'),
         count(*) filter (where u.created_at >= v_day_start and u.kind = 'chat')
    into v_minute, v_searches, v_chats
    from public.ask_usage u
   where u.subject = p_subject and u.created_at >= least(v_day_start, now() - interval '1 minute');
  v_left := greatest(v_limits.per_day - v_searches, 0);
  if v_minute >= v_limits.per_minute then
    return query select false, 'rate_limited', null::uuid, v_left, false; return;
  end if;
  if (p_kind = 'search' and v_searches >= v_limits.per_day) or (p_kind = 'chat' and v_chats >= v_limits.chat_per_day) then
    return query select false, 'quota_exhausted', null::uuid, v_left, false; return;
  end if;

  select coalesce(sum(u.cost_micro_usd) filter (where u.created_at >= v_day_start), 0), coalesce(sum(u.cost_micro_usd), 0)
    into v_day_spend, v_month_spend
    from public.ask_usage u where u.created_at >= v_month_start;
  -- NZD cents -> micro-USD: cents / 100 / rate * 1,000,000.
  v_day_cap := v_settings.daily_budget_nzd_cents * 10000 / v_settings.usd_to_nzd;
  v_month_cap := v_settings.monthly_budget_nzd_cents * 10000 / v_settings.usd_to_nzd;
  if v_day_spend >= v_day_cap or v_month_spend >= v_month_cap then
    return query select false, 'budget_exhausted', null::uuid, v_left, false; return;
  end if;

  v_degrade := v_day_spend >= v_day_cap * v_settings.degrade_ratio or v_month_spend >= v_month_cap * v_settings.degrade_ratio;
  insert into public.ask_usage (subject, tier, user_id, degraded, kind) values (p_subject, p_tier, p_user, v_degrade, p_kind)
    returning id into v_id;
  return query select true, null::text, v_id, case when p_kind = 'search' then v_left - 1 else v_left end, v_degrade;
end;
$$;

revoke execute on function public.ask_reserve(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.ask_reserve(text, text, uuid, text) to service_role;
