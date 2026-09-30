-- Voice ask: per-person quotas and a global spend cap. Only the server (secret key) can read or
-- write these tables; RLS is on with no policies and the functions are service-role only.
create table public.ask_limits (
  tier text primary key check (tier in ('guest', 'free', 'plus')),
  per_day integer not null check (per_day >= 0),
  per_minute integer not null check (per_minute >= 0)
);
insert into public.ask_limits (tier, per_day, per_minute) values
  ('guest', 5, 10), ('free', 20, 10), ('plus', 200, 10);

create table public.ask_settings (
  id integer primary key default 1 check (id = 1),
  daily_budget_nzd_cents integer not null default 50 check (daily_budget_nzd_cents >= 0),
  monthly_budget_nzd_cents integer not null default 800 check (monthly_budget_nzd_cents >= 0),
  usd_to_nzd numeric not null default 1.75 check (usd_to_nzd > 0),
  degrade_ratio numeric not null default 0.8 check (degrade_ratio > 0 and degrade_ratio <= 1)
);
insert into public.ask_settings default values;

create table public.ask_usage (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(subject) <= 80),
  tier text not null references public.ask_limits (tier),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  cost_micro_usd integer not null default 0 check (cost_micro_usd >= 0),
  degraded boolean not null default false
);
create index ask_usage_subject_created on public.ask_usage (subject, created_at desc);
create index ask_usage_created on public.ask_usage (created_at);

alter table public.ask_limits enable row level security;
alter table public.ask_settings enable row level security;
alter table public.ask_usage enable row level security;
revoke all on public.ask_limits, public.ask_settings, public.ask_usage from anon, authenticated;

create function public.ask_reserve(p_subject text, p_tier text, p_user uuid)
returns table (allowed boolean, reason text, usage_id uuid, remaining integer, degrade boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_limits public.ask_limits%rowtype;
  v_settings public.ask_settings%rowtype;
  v_day_start timestamptz := date_trunc('day', now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Pacific/Auckland') at time zone 'Pacific/Auckland';
  v_minute integer; v_today integer; v_day_spend bigint; v_month_spend bigint;
  v_day_cap numeric; v_month_cap numeric; v_degrade boolean; v_id uuid;
begin
  -- Serialise requests from one subject so two tabs cannot both take the last free ask.
  perform pg_advisory_xact_lock(hashtext(p_subject));
  select * into v_limits from public.ask_limits l where l.tier = p_tier;
  if not found then return query select false, 'invalid_tier', null::uuid, 0, false; return; end if;
  select * into v_settings from public.ask_settings s where s.id = 1;
  delete from public.ask_usage u where u.created_at < now() - interval '40 days';

  select count(*) filter (where u.created_at > now() - interval '1 minute'),
         count(*) filter (where u.created_at >= v_day_start)
    into v_minute, v_today
    from public.ask_usage u
   where u.subject = p_subject and u.created_at >= least(v_day_start, now() - interval '1 minute');
  if v_minute >= v_limits.per_minute then
    return query select false, 'rate_limited', null::uuid, greatest(v_limits.per_day - v_today, 0), false; return;
  end if;
  if v_today >= v_limits.per_day then
    return query select false, 'quota_exhausted', null::uuid, 0, false; return;
  end if;

  select coalesce(sum(u.cost_micro_usd) filter (where u.created_at >= v_day_start), 0), coalesce(sum(u.cost_micro_usd), 0)
    into v_day_spend, v_month_spend
    from public.ask_usage u where u.created_at >= v_month_start;
  -- NZD cents -> micro-USD: cents / 100 / rate * 1,000,000.
  v_day_cap := v_settings.daily_budget_nzd_cents * 10000 / v_settings.usd_to_nzd;
  v_month_cap := v_settings.monthly_budget_nzd_cents * 10000 / v_settings.usd_to_nzd;
  if v_day_spend >= v_day_cap or v_month_spend >= v_month_cap then
    return query select false, 'budget_exhausted', null::uuid, greatest(v_limits.per_day - v_today, 0), false; return;
  end if;

  v_degrade := v_day_spend >= v_day_cap * v_settings.degrade_ratio or v_month_spend >= v_month_cap * v_settings.degrade_ratio;
  insert into public.ask_usage (subject, tier, user_id, degraded) values (p_subject, p_tier, p_user, v_degrade)
    returning id into v_id;
  return query select true, null::text, v_id, v_limits.per_day - v_today - 1, v_degrade;
end;
$$;

create function public.ask_record_cost(p_usage_id uuid, p_cost integer, p_degraded boolean)
returns void language sql security definer set search_path = '' as $$
  update public.ask_usage set cost_micro_usd = greatest(p_cost, 0), degraded = degraded or p_degraded
   where id = p_usage_id;
$$;

revoke execute on function public.ask_reserve(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.ask_record_cost(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function public.ask_reserve(text, text, uuid) to service_role;
grant execute on function public.ask_record_cost(uuid, integer, boolean) to service_role;
