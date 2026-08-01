create table if not exists public.short_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  target_url text not null,
  link_type text not null default 'invoice',
  entity_type text,
  entity_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint short_links_slug_format check (slug ~ '^[A-Za-z0-9_-]{6,32}$')
);

create unique index if not exists idx_short_links_active_entity
  on public.short_links (link_type, entity_type, entity_id)
  where is_active = true and entity_id is not null;

create index if not exists idx_short_links_slug_active
  on public.short_links (slug, is_active);

create index if not exists idx_short_links_target
  on public.short_links (target_url);

alter table public.short_links enable row level security;

create or replace function public.increment_short_link_access(p_slug text)
returns void
language sql
security definer
as $$
  update public.short_links
  set access_count = access_count + 1,
      last_accessed_at = now()
  where slug = p_slug
    and is_active = true;
$$;

revoke all on function public.increment_short_link_access(text) from public;
grant execute on function public.increment_short_link_access(text) to service_role;
