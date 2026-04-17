create table if not exists public.coder_session_access (
  id uuid primary key default gen_random_uuid(),
  coder_id uuid not null references public.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  granted_reason text not null default 'SESSION_COMPLETED',
  granted_at timestamptz not null default now(),
  source_enrollment_id uuid references public.enrollments(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists coder_session_access_coder_session_uidx
  on public.coder_session_access (coder_id, session_id);

create index if not exists coder_session_access_coder_idx
  on public.coder_session_access (coder_id, granted_at desc);

create index if not exists coder_session_access_class_idx
  on public.coder_session_access (class_id, granted_at desc);
