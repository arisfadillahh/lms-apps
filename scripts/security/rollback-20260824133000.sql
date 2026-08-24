begin;

do $$
declare
  saved record;
  privilege text;
begin
  for saved in select * from public.security_hardening_access_backup
  loop
    if saved.rls_enabled then
      execute format('alter table public.%I enable row level security', saved.table_name);
    else
      execute format('alter table public.%I disable row level security', saved.table_name);
    end if;

    execute format('revoke all privileges on table public.%I from public, anon, authenticated', saved.table_name);
    foreach privilege in array saved.public_privileges loop
      execute format('grant %s on table public.%I to public', privilege, saved.table_name);
    end loop;
    foreach privilege in array saved.anon_privileges loop
      execute format('grant %s on table public.%I to anon', privilege, saved.table_name);
    end loop;
    foreach privilege in array saved.authenticated_privileges loop
      execute format('grant %s on table public.%I to authenticated', privilege, saved.table_name);
    end loop;
  end loop;
end
$$;

do $$
declare
  saved record;
begin
  for saved in select * from public.security_hardening_routine_access_backup
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', saved.function_identity);
    if saved.public_execute then execute format('grant execute on function %s to public', saved.function_identity); end if;
    if saved.anon_execute then execute format('grant execute on function %s to anon', saved.function_identity); end if;
    if saved.authenticated_execute then execute format('grant execute on function %s to authenticated', saved.function_identity); end if;
  end loop;
end
$$;

do $$
declare
  saved record;
  privilege text;
begin
  for saved in select * from public.security_hardening_sequence_access_backup
  loop
    execute format('revoke all privileges on sequence public.%I from public, anon, authenticated', saved.sequence_name);
    foreach privilege in array saved.public_privileges loop
      execute format('grant %s on sequence public.%I to public', privilege, saved.sequence_name);
    end loop;
    foreach privilege in array saved.anon_privileges loop
      execute format('grant %s on sequence public.%I to anon', privilege, saved.sequence_name);
    end loop;
    foreach privilege in array saved.authenticated_privileges loop
      execute format('grant %s on sequence public.%I to authenticated', privilege, saved.sequence_name);
    end loop;
  end loop;
end
$$;

drop index if exists public.push_subscriptions_endpoint_unique_idx;
alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_endpoint_key unique (user_id, endpoint);

drop function if exists public.consume_api_rate_limit(text, text, integer, integer);
drop function if exists public.claim_midtrans_webhook_event(text, text, text, text);
drop table if exists public.api_rate_limit_events;
drop table if exists public.midtrans_webhook_events;
drop table if exists public.security_hardening_sequence_access_backup;
drop table if exists public.security_hardening_routine_access_backup;
drop table if exists public.security_hardening_access_backup;

commit;
