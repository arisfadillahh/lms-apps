begin;

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  reporter_role text not null check (reporter_role in ('COACH', 'CODER')),
  reporter_name text not null,
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  screenshot_url text,
  screenshot_storage_path text,
  page_url text,
  user_agent text,
  viewport jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  admin_notes text,
  resolution_summary text,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  whatsapp_status text not null default 'PENDING' check (whatsapp_status in ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  whatsapp_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists issue_reports_status_created_idx
  on public.issue_reports (status, created_at desc);
create index if not exists issue_reports_reporter_idx
  on public.issue_reports (reporter_id, created_at desc);

create or replace function public.set_issue_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists issue_reports_set_updated_at on public.issue_reports;
create trigger issue_reports_set_updated_at
before update on public.issue_reports
for each row execute function public.set_issue_reports_updated_at();

alter table public.issue_reports enable row level security;

comment on table public.issue_reports is
  'Problem reports submitted by authenticated coach and coder accounts. Access is mediated by LMS server APIs.';

commit;
