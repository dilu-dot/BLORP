-- Blorp V5.5: account/membership data only. Chat history and generated sites remain local.
-- Run on a NEW dedicated Blorp Supabase project, never a personal app's database.

create table if not exists public.blorp_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('builder','studio')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index if not exists blorp_memberships_expires_idx on public.blorp_memberships(expires_at);

create table if not exists public.blorp_plan_prices (
  code text primary key check (code in ('builder_monthly','builder_annual','studio_monthly','studio_annual')),
  amount_inr_paise integer check (amount_inr_paise between 100 and 50000000),
  updated_at timestamptz not null default now()
);
insert into public.blorp_plan_prices(code,amount_inr_paise) values
  ('builder_monthly',null),('builder_annual',null),('studio_monthly',null),('studio_annual',null)
on conflict (code) do nothing;

create table if not exists public.blorp_payment_config (
  id boolean primary key default true check (id),
  upi_id text not null default '' check (length(upi_id)<=120),
  qr_image_url text not null default '' check (length(qr_image_url)<=500),
  updated_at timestamptz not null default now()
);
insert into public.blorp_payment_config(id) values(true) on conflict do nothing;

create table if not exists public.blorp_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('builder','studio')),
  term text not null check (term in ('monthly','annual')),
  amount_inr_paise integer not null check (amount_inr_paise between 100 and 50000000),
  utr text not null check (utr ~ '^[A-Z0-9-]{8,40}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  payer_name text not null default '' check (length(payer_name)<=100),
  owner_note text not null default '' check (length(owner_note)<=500)
);
create unique index if not exists blorp_payment_utr_unique on public.blorp_payment_requests(utr);
-- One unresolved request at a time, enforced even under concurrent submissions.
create unique index if not exists blorp_one_pending_per_user on public.blorp_payment_requests(user_id) where status = 'pending';
create index if not exists blorp_payment_user_created_idx on public.blorp_payment_requests(user_id, created_at desc);
create index if not exists blorp_payment_pending_created_idx on public.blorp_payment_requests(status, created_at desc);

-- Privileged Owner identity is controlled by the database operator, not user metadata.
create table if not exists public.blorp_owner_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
create table if not exists public.blorp_payment_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.blorp_payment_requests(id),
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('approved','rejected')),
  verified_amount_inr_paise integer,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- RLS: customers can read only their own current plan / submitted UTR entries.
-- All writes take place through the authenticated Edge Function and server secret.
alter table public.blorp_memberships enable row level security;
alter table public.blorp_plan_prices enable row level security;
alter table public.blorp_payment_config enable row level security;
alter table public.blorp_payment_requests enable row level security;
alter table public.blorp_owner_accounts enable row level security;
alter table public.blorp_payment_audit enable row level security;

revoke all on public.blorp_memberships, public.blorp_plan_prices,
  public.blorp_payment_config, public.blorp_payment_requests,
  public.blorp_owner_accounts, public.blorp_payment_audit
  from anon, authenticated;

grant select on public.blorp_memberships, public.blorp_plan_prices,
  public.blorp_payment_config, public.blorp_payment_requests to authenticated;

create policy "blorp member reads own plan" on public.blorp_memberships
 for select to authenticated using (user_id = (select auth.uid()));
create policy "blorp member reads own UTR status" on public.blorp_payment_requests
 for select to authenticated using (user_id = (select auth.uid()));
create policy "blorp member reads prices" on public.blorp_plan_prices
 for select to authenticated using (true);
create policy "blorp member reads payment instructions" on public.blorp_payment_config
 for select to authenticated using (true);

-- SECURITY DEFINER payment mutations run as a single PostgreSQL transaction.
-- They are not callable from public/anon/authenticated; only Edge's service role.
create or replace function public.blorp_approve_payment(
  p_request_id uuid, p_actor_id uuid, p_verified_utr text,
  p_verified_amount_inr_paise integer, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  rec public.blorp_payment_requests%rowtype;
  old_expiry timestamptz;
  next_expiry timestamptz;
  result jsonb;
begin
  if not exists(select 1 from public.blorp_owner_accounts where user_id=p_actor_id) then
    raise exception 'Owner authorization required';
  end if;
  if p_note is null or length(trim(p_note)) < 8 or length(p_note)>500 then
    raise exception 'Verification note must be 8-500 characters';
  end if;
  select * into rec from public.blorp_payment_requests
    where id=p_request_id for update;
  if not found then raise exception 'Payment request not found'; end if;
  if rec.status <> 'pending' then raise exception 'Payment request already reviewed'; end if;
  if upper(trim(p_verified_utr)) <> rec.utr
    or p_verified_amount_inr_paise <> rec.amount_inr_paise then
    raise exception 'Verified bank UTR/amount does not match request';
  end if;
  -- Serialize renewal of a user's membership across independent payment rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(rec.user_id::text, 0));
  -- The server must verify the transfer independently before calling this function.
  select expires_at into old_expiry from public.blorp_memberships where user_id=rec.user_id;
  next_expiry:=greatest(coalesce(old_expiry, now()), now())+
    case when rec.term='monthly' then interval '30 days' else interval '365 days' end;
  insert into public.blorp_memberships(user_id,plan,expires_at,updated_at,updated_by)
    values(rec.user_id,rec.plan,next_expiry,now(),p_actor_id)
    on conflict(user_id) do update
      set plan=excluded.plan,expires_at=excluded.expires_at,
          updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  update public.blorp_payment_requests set status='approved',reviewed_at=now(),
    reviewed_by=p_actor_id,owner_note=p_note where id=rec.id;
  insert into public.blorp_payment_audit(request_id,actor_id,action,verified_amount_inr_paise,note)
    values(rec.id,p_actor_id,'approved',p_verified_amount_inr_paise,p_note);
  select jsonb_build_object('request_id',rec.id,'user_id',rec.user_id,
    'plan',rec.plan,'expires_at',next_expiry) into result;
  return result;
end; $$;

create or replace function public.blorp_reject_payment(
  p_request_id uuid, p_actor_id uuid, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare rec public.blorp_payment_requests%rowtype;
begin
  if not exists(select 1 from public.blorp_owner_accounts where user_id=p_actor_id) then
    raise exception 'Owner authorization required';
  end if;
  if p_note is null or length(trim(p_note))<8 or length(p_note)>500 then
    raise exception 'Rejection note must be 8-500 characters';
  end if;
  select * into rec from public.blorp_payment_requests where id=p_request_id for update;
  if not found then raise exception 'Payment request not found'; end if;
  if rec.status<>'pending' then raise exception 'Payment request already reviewed'; end if;
  update public.blorp_payment_requests set status='rejected',reviewed_at=now(),
    reviewed_by=p_actor_id,owner_note=p_note where id=rec.id;
  insert into public.blorp_payment_audit(request_id,actor_id,action,note)
    values(rec.id,p_actor_id,'rejected',p_note);
  return jsonb_build_object('request_id',rec.id,'status','rejected');
end; $$;

revoke execute on function public.blorp_approve_payment(uuid,uuid,text,integer,text) from public,anon,authenticated;
revoke execute on function public.blorp_reject_payment(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.blorp_approve_payment(uuid,uuid,text,integer,text) to service_role;
grant execute on function public.blorp_reject_payment(uuid,uuid,text) to service_role;

grant all on public.blorp_memberships, public.blorp_plan_prices,
  public.blorp_payment_config, public.blorp_payment_requests,
  public.blorp_owner_accounts, public.blorp_payment_audit to service_role;
grant usage, select on sequence public.blorp_payment_audit_id_seq to service_role;

comment on table public.blorp_memberships is 'Only current plan and expiry; no chat, project or website data.';
comment on table public.blorp_owner_accounts is 'Operator-only owner grants; never writable by the customer client.';