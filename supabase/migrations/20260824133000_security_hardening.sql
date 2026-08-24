begin;

-- One browser push endpoint may belong to exactly one current LMS account.
with ranked as (
  select id,
         row_number() over (partition by endpoint order by updated_at desc nulls last, created_at desc, id desc) as position
  from public.push_subscriptions
)
delete from public.push_subscriptions target
using ranked
where target.id = ranked.id
  and ranked.position > 1;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_user_id_endpoint_key;

create unique index if not exists push_subscriptions_endpoint_unique_idx
  on public.push_subscriptions (endpoint);

create table if not exists public.security_hardening_access_backup (
  table_name text primary key,
  rls_enabled boolean not null,
  public_privileges text[] not null default '{}',
  anon_privileges text[] not null default '{}',
  authenticated_privileges text[] not null default '{}',
  captured_at timestamptz not null default now()
);

insert into public.security_hardening_access_backup (
  table_name, rls_enabled, public_privileges, anon_privileges, authenticated_privileges
)
select
  tables.tablename,
  classes.relrowsecurity,
  coalesce((
    select array_agg(distinct grants.privilege_type order by grants.privilege_type)
    from information_schema.role_table_grants grants
    where grants.table_schema = 'public'
      and grants.table_name = tables.tablename
      and grants.grantee = 'PUBLIC'
  ), '{}'),
  coalesce((
    select array_agg(distinct grants.privilege_type order by grants.privilege_type)
    from information_schema.role_table_grants grants
    where grants.table_schema = 'public'
      and grants.table_name = tables.tablename
      and grants.grantee = 'anon'
  ), '{}'),
  coalesce((
    select array_agg(distinct grants.privilege_type order by grants.privilege_type)
    from information_schema.role_table_grants grants
    where grants.table_schema = 'public'
      and grants.table_name = tables.tablename
      and grants.grantee = 'authenticated'
  ), '{}')
from pg_tables tables
join pg_class classes on classes.relname = tables.tablename
join pg_namespace namespaces on namespaces.oid = classes.relnamespace and namespaces.nspname = tables.schemaname
where tables.schemaname = 'public'
  and tables.tablename <> 'security_hardening_access_backup'
on conflict (table_name) do nothing;

create table if not exists public.security_hardening_routine_access_backup (
  function_identity text primary key,
  public_execute boolean not null,
  anon_execute boolean not null,
  authenticated_execute boolean not null
);

insert into public.security_hardening_routine_access_backup (
  function_identity, public_execute, anon_execute, authenticated_execute
)
select
  format('%I.%I(%s)', namespaces.nspname, routines.proname, pg_get_function_identity_arguments(routines.oid)),
  bool_or(access.grantee = 0 and access.privilege_type = 'EXECUTE'),
  bool_or(access.grantee = to_regrole('anon')::oid and access.privilege_type = 'EXECUTE'),
  bool_or(access.grantee = to_regrole('authenticated')::oid and access.privilege_type = 'EXECUTE')
from pg_proc routines
join pg_namespace namespaces on namespaces.oid = routines.pronamespace
cross join lateral aclexplode(coalesce(routines.proacl, acldefault('f', routines.proowner))) access
where namespaces.nspname = 'public'
group by routines.oid, namespaces.nspname, routines.proname
on conflict (function_identity) do nothing;

create table if not exists public.security_hardening_sequence_access_backup (
  sequence_name text primary key,
  public_privileges text[] not null default '{}',
  anon_privileges text[] not null default '{}',
  authenticated_privileges text[] not null default '{}'
);

insert into public.security_hardening_sequence_access_backup (
  sequence_name, public_privileges, anon_privileges, authenticated_privileges
)
select
  sequences.relname,
  coalesce(array_agg(distinct access.privilege_type order by access.privilege_type)
    filter (where access.grantee = 0), '{}'),
  coalesce(array_agg(distinct access.privilege_type order by access.privilege_type)
    filter (where access.grantee = to_regrole('anon')::oid), '{}'),
  coalesce(array_agg(distinct access.privilege_type order by access.privilege_type)
    filter (where access.grantee = to_regrole('authenticated')::oid), '{}')
from pg_class sequences
join pg_namespace namespaces on namespaces.oid = sequences.relnamespace
cross join lateral aclexplode(coalesce(sequences.relacl, acldefault('S', sequences.relowner))) access
where namespaces.nspname = 'public'
  and sequences.relkind = 'S'
group by sequences.relname
on conflict (sequence_name) do nothing;

alter table public.security_hardening_access_backup enable row level security;
alter table public.security_hardening_routine_access_backup enable row level security;
alter table public.security_hardening_sequence_access_backup enable row level security;
revoke all privileges on table public.security_hardening_access_backup from public, anon, authenticated;
revoke all privileges on table public.security_hardening_routine_access_backup from public, anon, authenticated;
revoke all privileges on table public.security_hardening_sequence_access_backup from public, anon, authenticated;

-- Server routes use service_role. Browser clients must not bypass those routes via anon PostgREST.
do $$
declare
  relation record;
begin
  for relation in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', relation.schemaname, relation.tablename);
    execute format('revoke all privileges on table %I.%I from public, anon, authenticated', relation.schemaname, relation.tablename);
  end loop;
end
$$;

revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

create table if not exists public.midtrans_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  order_id text not null,
  transaction_id text,
  transaction_status text,
  state text not null default 'PROCESSING' check (state in ('PROCESSING', 'PROCESSED', 'FAILED')),
  failure_reason text,
  claimed_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.midtrans_webhook_events enable row level security;
revoke all privileges on table public.midtrans_webhook_events from anon, authenticated;

comment on table public.midtrans_webhook_events is
  'Idempotency ledger for verified Midtrans notification events. Access is service-role only.';

create or replace function public.claim_midtrans_webhook_event(
  p_event_key text,
  p_order_id text,
  p_transaction_id text,
  p_transaction_status text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.midtrans_webhook_events%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_event_key));

  select * into existing
  from public.midtrans_webhook_events
  where event_key = p_event_key
  for update;

  if not found then
    insert into public.midtrans_webhook_events (
      event_key, order_id, transaction_id, transaction_status
    ) values (
      p_event_key, p_order_id, p_transaction_id, p_transaction_status
    );
    return 'CLAIMED';
  end if;

  if existing.state = 'PROCESSED' then
    return 'DUPLICATE';
  end if;

  if existing.state = 'PROCESSING' and existing.claimed_at > now() - interval '5 minutes' then
    return 'IN_PROGRESS';
  end if;

  update public.midtrans_webhook_events
  set state = 'PROCESSING',
      failure_reason = null,
      claimed_at = now(),
      updated_at = now(),
      transaction_id = coalesce(p_transaction_id, transaction_id),
      transaction_status = coalesce(p_transaction_status, transaction_status)
  where event_key = p_event_key;

  return 'CLAIMED';
end;
$$;

revoke all on function public.claim_midtrans_webhook_event(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_midtrans_webhook_event(text, text, text, text) to service_role;

create table if not exists public.api_rate_limit_events (
  id bigint generated always as identity primary key,
  key_hash text not null,
  scope text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_limit_events_lookup_idx
  on public.api_rate_limit_events (key_hash, scope, created_at desc);

alter table public.api_rate_limit_events enable row level security;
revoke all privileges on table public.api_rate_limit_events from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_scope text,
  p_window_seconds integer,
  p_max_requests integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if p_window_seconds < 1 or p_max_requests < 1 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_key_hash || ':' || p_scope));
  select count(*) into recent_count
  from public.api_rate_limit_events
  where key_hash = p_key_hash
    and scope = p_scope
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if recent_count >= p_max_requests then
    return false;
  end if;

  insert into public.api_rate_limit_events (key_hash, scope)
  values (p_key_hash, p_scope);

  if random() < 0.01 then
    delete from public.api_rate_limit_events where created_at < now() - interval '7 days';
  end if;

  return true;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

commit;
