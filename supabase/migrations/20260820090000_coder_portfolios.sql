begin;

create table if not exists public.coder_portfolio_profiles (
  coder_id uuid primary key references public.users(id) on delete cascade,
  public_slug text not null unique check (public_slug ~ '^[a-z0-9-]{8,80}$'),
  school_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coder_portfolios (
  id uuid primary key default gen_random_uuid(),
  coder_id uuid not null references public.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  block_id uuid references public.blocks(id) on delete set null,
  evaluation_session_id uuid references public.block_evaluation_sessions(id) on delete set null,
  program_type text not null check (program_type in ('WEEKLY', 'EKSKUL')),
  title text not null check (char_length(title) between 3 and 120),
  project_type text not null default '',
  summary text not null default '',
  description text not null default '',
  role_contribution text not null default '',
  tools text[] not null default '{}',
  how_to_play text not null default '',
  playable_url text not null default '',
  repository_url text,
  video_url text,
  learning_reflection text not null default '',
  next_steps text not null default '',
  skills text[] not null default '{}',
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'REVISION', 'APPROVED')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  published_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coder_portfolios_complete_content check (
    status = 'DRAFT' or (
      char_length(project_type) between 2 and 80
      and char_length(summary) between 10 and 240
      and char_length(description) between 20 and 3000
      and char_length(role_contribution) between 10 and 1500
      and char_length(how_to_play) between 10 and 1500
      and char_length(playable_url) between 8 and 2000
      and char_length(learning_reflection) between 10 and 2000
      and char_length(next_steps) between 10 and 1500
      and cardinality(tools) > 0
      and cardinality(skills) > 0
    )
  )
);

create table if not exists public.coder_portfolio_screenshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.coder_portfolios(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  sort_order smallint not null check (sort_order between 0 and 4),
  alt_text text check (alt_text is null or char_length(alt_text) <= 160),
  created_at timestamptz not null default now(),
  unique (portfolio_id, sort_order)
);

create index if not exists coder_portfolios_coder_updated_idx
  on public.coder_portfolios (coder_id, updated_at desc);
create index if not exists coder_portfolios_review_queue_idx
  on public.coder_portfolios (class_id, status, submitted_at desc)
  where status = 'SUBMITTED';
create index if not exists coder_portfolios_block_idx
  on public.coder_portfolios (block_id, coder_id);
create index if not exists coder_portfolios_evaluation_session_idx
  on public.coder_portfolios (evaluation_session_id, coder_id);
create index if not exists coder_portfolio_screenshots_portfolio_idx
  on public.coder_portfolio_screenshots (portfolio_id, sort_order);

create or replace function public.set_coder_portfolio_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coder_portfolio_profiles_set_updated_at on public.coder_portfolio_profiles;
create trigger coder_portfolio_profiles_set_updated_at
before update on public.coder_portfolio_profiles
for each row execute function public.set_coder_portfolio_updated_at();

drop trigger if exists coder_portfolios_set_updated_at on public.coder_portfolios;
create trigger coder_portfolios_set_updated_at
before update on public.coder_portfolios
for each row execute function public.set_coder_portfolio_updated_at();

alter table public.coder_portfolio_profiles enable row level security;
alter table public.coder_portfolios enable row level security;
alter table public.coder_portfolio_screenshots enable row level security;

comment on table public.coder_portfolio_profiles is
  'Stable public sharing profile for a coder. Server APIs mediate all writes and public reads.';
comment on table public.coder_portfolios is
  'Coder-owned project drafts and review state. published_snapshot keeps the last approved public version stable during edits.';
comment on column public.coder_portfolios.program_type is
  'Immutable WEEKLY or EKSKUL snapshot from the selected class at portfolio creation time.';
comment on table public.coder_portfolio_screenshots is
  'Up to five ordered screenshots per portfolio, enforced by server validation and sort_order uniqueness.';

commit;
