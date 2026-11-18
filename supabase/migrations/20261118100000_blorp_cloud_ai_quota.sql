-- Blorp Cloud AI metering: server-only request caps, no prompt or website content stored.
create table if not exists public.blorp_ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  requests integer not null default 0 check (requests between 0 and 1000),
  primary key(user_id,usage_day)
);
alter table public.blorp_ai_daily_usage enable row level security;
revoke all on public.blorp_ai_daily_usage from public, anon, authenticated;
grant all on public.blorp_ai_daily_usage to service_role;

create or replace function public.blorp_ai_try_consume(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  plan_value text;
  daily_limit integer;
  current_count integer;
  today_utc date := (now() at time zone 'utc')::date;
begin
  if p_user_id is null then raise exception 'User required'; end if;
  select plan into plan_value from public.blorp_memberships
    where user_id=p_user_id and expires_at > now();
  daily_limit := case plan_value when 'studio' then 60 when 'builder' then 20 else 0 end;
  if daily_limit=0 then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','premium_required','limit',0,'remaining',0);
  end if;
  insert into public.blorp_ai_daily_usage(user_id,usage_day,requests)
    values(p_user_id,today_utc,1)
  on conflict(user_id,usage_day) do update
    set requests=public.blorp_ai_daily_usage.requests+1
    where public.blorp_ai_daily_usage.requests<daily_limit
  returning requests into current_count;
  if current_count is null then
    return pg_catalog.jsonb_build_object('allowed',false,'reason','daily_limit','limit',daily_limit,'remaining',0);
  end if;
  return pg_catalog.jsonb_build_object('allowed',true,'limit',daily_limit,'remaining',daily_limit-current_count);
end; $$;
revoke all on function public.blorp_ai_try_consume(uuid) from public, anon, authenticated;
grant execute on function public.blorp_ai_try_consume(uuid) to service_role;
comment on table public.blorp_ai_daily_usage is 'Per-user daily counts only; never stores prompts or responses.';
