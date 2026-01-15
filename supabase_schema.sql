-- Supabase schema for the LMS application
-- Run this script inside your Supabase/Postgres instance.

create extension if not exists "pgcrypto";

-- Enumerated types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_enum') then
    create type public.role_enum as enum ('ADMIN', 'COACH', 'CODER');
  end if;
  if not exists (select 1 from pg_type where typname = 'class_type_enum') then
    create type public.class_type_enum as enum ('WEEKLY', 'EKSKUL');
  end if;
  if not exists (select 1 from pg_type where typname = 'class_block_status_enum') then
    create type public.class_block_status_enum as enum ('UPCOMING', 'CURRENT', 'COMPLETED');
  end if;
  if not exists (select 1 from pg_type where typname = 'session_status_enum') then
    create type public.session_status_enum as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');
  end if;
  if not exists (select 1 from pg_type where typname = 'enrollment_status_enum') then
    create type public.enrollment_status_enum as enum ('ACTIVE', 'INACTIVE');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status_enum') then
    create type public.attendance_status_enum as enum ('PRESENT', 'LATE', 'EXCUSED', 'ABSENT');
  end if;
  if not exists (select 1 from pg_type where typname = 'make_up_status_enum') then
    create type public.make_up_status_enum as enum ('PENDING_UPLOAD', 'SUBMITTED', 'REVIEWED');
  end if;
  if not exists (select 1 from pg_type where typname = 'rubric_submission_status_enum') then
    create type public.rubric_submission_status_enum as enum ('DRAFT', 'FINAL');
  end if;
  if not exists (select 1 from pg_type where typname = 'whatsapp_category_enum') then
    create type public.whatsapp_category_enum as enum ('PARENT_ABSENT', 'REPORT_SEND', 'REMINDER');
  end if;
  if not exists (select 1 from pg_type where typname = 'whatsapp_status_enum') then
    create type public.whatsapp_status_enum as enum ('QUEUED', 'SENT', 'FAILED');
  end if;
  if not exists (select 1 from pg_type where typname = 'coach_leave_status_enum') then
    create type public.coach_leave_status_enum as enum ('PENDING', 'APPROVED', 'REJECTED');
  end if;
end
$$;

-- Enum used for coder journeys
do $$
begin
  if not exists (select 1 from pg_type where typname = 'coder_block_status_enum') then
    create type public.coder_block_status_enum as enum ('PENDING', 'IN_PROGRESS', 'COMPLETED');
  end if;
end $$;

-- Helper function to keep updated_at current
create or replace function public.set_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Users =========================================================================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  full_name text not null,
  role public.role_enum not null,
  parent_contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_username_key on public.users (username);
create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at_timestamp();

-- Levels ========================================================================================
create table public.levels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default now()
);

create unique index levels_name_key on public.levels (name);
create unique index levels_order_index_key on public.levels (order_index);

-- Blocks ========================================================================================
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  name text not null,
  summary text,
  order_index integer not null check (order_index >= 0),
  estimated_sessions integer check (estimated_sessions >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (level_id, name),
  unique (level_id, order_index)
);

create trigger trg_blocks_updated_at
before update on public.blocks
for each row execute function public.set_updated_at_timestamp();

-- Classes =======================================================================================
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.class_type_enum not null,
  level_id uuid references public.levels(id) on delete set null,
  coach_id uuid not null references public.users(id) on delete restrict,
  schedule_day text not null,
  schedule_time time not null,
  zoom_link text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classes_coach_id_idx on public.classes (coach_id);
create trigger trg_classes_updated_at
before update on public.classes
for each row execute function public.set_updated_at_timestamp();

-- Class Blocks ==================================================================================
create table public.class_blocks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  block_id uuid not null references public.blocks(id) on delete restrict,
  status public.class_block_status_enum not null default 'UPCOMING',
  start_date date not null,
  end_date date not null,
  pitching_day_date date,
  created_at timestamptz not null default now()
);

create index class_blocks_class_id_idx on public.class_blocks (class_id);
create index class_blocks_block_id_idx on public.class_blocks (block_id);

-- Lesson Templates ==============================================================================
create table public.lesson_templates (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks(id) on delete cascade,
  title text not null,
  summary text,
  slide_url text,
  example_url text,
  example_storage_path text,
  order_index integer not null check (order_index >= 0),
  duration_minutes integer check (duration_minutes >= 0),
  make_up_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (block_id, order_index)
);

create index lesson_templates_block_id_idx on public.lesson_templates (block_id, order_index);
create trigger trg_lesson_templates_updated_at
before update on public.lesson_templates
for each row execute function public.set_updated_at_timestamp();

-- Sessions ======================================================================================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  date_time timestamptz not null,
  zoom_link_snapshot text not null,
  status public.session_status_enum not null default 'SCHEDULED',
  substitute_coach_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_class_id_idx on public.sessions (class_id, date_time);
create index sessions_substitute_coach_id_idx on public.sessions (substitute_coach_id);
create trigger trg_sessions_updated_at
before update on public.sessions
for each row execute function public.set_updated_at_timestamp();

-- Enrollments ===================================================================================
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  coder_id uuid not null references public.users(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  status public.enrollment_status_enum not null default 'ACTIVE',
  unique (class_id, coder_id)
);

create index enrollments_coder_id_idx on public.enrollments (coder_id);

-- Attendance ====================================================================================
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  coder_id uuid not null references public.users(id) on delete cascade,
  status public.attendance_status_enum not null,
  reason text,
  make_up_task_created boolean not null default false,
  recorded_by uuid not null references public.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (session_id, coder_id)
);

create index attendance_session_id_idx on public.attendance (session_id);
create index attendance_coder_id_idx on public.attendance (coder_id);

-- Class Lessons =================================================================================
create table public.class_lessons (
  id uuid primary key default gen_random_uuid(),
  class_block_id uuid not null references public.class_blocks(id) on delete cascade,
  lesson_template_id uuid references public.lesson_templates(id) on delete set null,
  title text not null,
  summary text,
  order_index integer not null check (order_index >= 0),
  session_id uuid references public.sessions(id) on delete set null,
  unlock_at timestamptz,
  make_up_instructions text,
  slide_url text,
  coach_example_url text,
  coach_example_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

create index class_lessons_class_block_idx on public.class_lessons (class_block_id, order_index);
create trigger trg_class_lessons_updated_at
before update on public.class_lessons
for each row execute function public.set_updated_at_timestamp();

-- Coder Block Progress ========================================================================
create table public.coder_block_progress (
  id uuid primary key default gen_random_uuid(),
  coder_id uuid not null references public.users(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  block_id uuid not null references public.blocks(id) on delete cascade,
  journey_order integer not null check (journey_order >= 0),
  status public.coder_block_status_enum not null default 'PENDING',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coder_id, block_id),
  unique (coder_id, level_id, journey_order)
);

create index coder_block_progress_coder_level_idx on public.coder_block_progress (coder_id, level_id, status);
create trigger trg_coder_block_progress_updated_at
before update on public.coder_block_progress
for each row execute function public.set_updated_at_timestamp();

-- Make-up Tasks =================================================================================
create table public.make_up_tasks (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  coder_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  class_lesson_id uuid references public.class_lessons(id) on delete set null,
  due_date timestamptz not null,
  status public.make_up_status_enum not null default 'PENDING_UPLOAD',
  instructions text,
  submission_files jsonb,
  submitted_at timestamptz,
  reviewed_by_coach_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  feedback text,
  created_at timestamptz not null default now(),
  unique (attendance_id)
);

create index make_up_tasks_status_due_idx on public.make_up_tasks (status, due_date);

-- Coach Leave Requests ========================================================================
create table public.coach_leave_requests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  status public.coach_leave_status_enum not null default 'PENDING',
  note text,
  substitute_coach_id uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, session_id)
);

create index coach_leave_requests_status_idx on public.coach_leave_requests (status);
create trigger trg_coach_leave_requests_updated_at
before update on public.coach_leave_requests
for each row execute function public.set_updated_at_timestamp();

-- Ekskul Session Competencies =================================================================
create table public.exkul_session_competencies (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  competencies jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

create trigger trg_exkul_session_competencies_updated_at
before update on public.exkul_session_competencies
for each row execute function public.set_updated_at_timestamp();

-- Materials =====================================================================================
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  block_id uuid references public.blocks(id) on delete set null,
  title text not null,
  description text,
  file_url text,
  coach_note text,
  visible_from_session_id uuid references public.sessions(id) on delete set null,
  uploaded_by_user_id uuid not null references public.users(id) on delete restrict,
  uploaded_by_role public.role_enum not null,
  created_at timestamptz not null default now()
);

create index materials_class_id_created_at_idx on public.materials (class_id, created_at desc);

-- Rubric Templates ==============================================================================
create table public.rubric_templates (
  id uuid primary key default gen_random_uuid(),
  class_type public.class_type_enum not null,
  level_id uuid references public.levels(id) on delete set null,
  competencies jsonb not null,
  positive_characters text[] not null default '{}',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index rubric_templates_class_type_idx on public.rubric_templates (class_type, level_id);

-- Rubric Submissions ============================================================================
create table public.rubric_submissions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  coder_id uuid not null references public.users(id) on delete cascade,
  block_id uuid references public.blocks(id) on delete set null,
  semester_tag text,
  rubric_template_id uuid not null references public.rubric_templates(id) on delete restrict,
  grades jsonb not null,
  positive_character_chosen text[] not null default '{}',
  narrative text not null,
  submitted_by uuid not null references public.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status public.rubric_submission_status_enum not null default 'FINAL'
);

create index rubric_submissions_class_coder_idx on public.rubric_submissions (class_id, coder_id);
create trigger trg_rubric_submissions_updated_at
before update on public.rubric_submissions
for each row execute function public.set_updated_at_timestamp();

-- Pitching Day Reports =========================================================================
create table public.pitching_day_reports (
  id uuid primary key default gen_random_uuid(),
  rubric_submission_id uuid not null references public.rubric_submissions(id) on delete cascade,
  pdf_url text not null,
  storage_path text not null,
  generated_at timestamptz not null default now(),
  sent_via_whatsapp boolean not null default false,
  sent_to_parent_at timestamptz,
  unique (rubric_submission_id)
);

-- WhatsApp Message Logs =========================================================================
create table public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  category public.whatsapp_category_enum not null,
  payload jsonb not null,
  response jsonb,
  status public.whatsapp_status_enum not null default 'QUEUED',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index whatsapp_message_logs_created_at_idx on public.whatsapp_message_logs (created_at desc);

-- Software =====================================================================================
create table public.software (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  version text,
  installation_url text,
  installation_instructions text,
  minimum_specs jsonb,
  access_info text,
  icon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_software_updated_at
before update on public.software
for each row execute function public.set_updated_at_timestamp();

-- Block Software (many-to-many) ================================================================
create table public.block_software (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks(id) on delete cascade,
  software_id uuid not null references public.software(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (block_id, software_id)
);

create index block_software_block_id_idx on public.block_software (block_id);

-- WhatsApp Templates ===========================================================================
-- Stores customizable message templates for different notification categories
create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  category varchar(50) not null unique,
  template_content text not null,
  variables jsonb default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  constraint valid_whatsapp_template_category check (category in ('PARENT_ABSENT', 'REPORT_SEND', 'REMINDER'))
);

create index whatsapp_templates_category_idx on public.whatsapp_templates (category);

-- Broadcast Logs ===============================================================================
-- Stores history of broadcast messages sent by admin
create table public.broadcast_logs (
  id uuid primary key default gen_random_uuid(),
  title varchar(255) not null,
  content text not null,
  target_audience varchar(50) not null default 'ALL',
  sent_by uuid references public.users(id),
  sent_at timestamptz not null default now(),
  total_recipients integer default 0,
  successful_count integer default 0,
  failed_count integer default 0,
  scheduled_for timestamptz,
  status varchar(50) not null default 'SENT',
  created_at timestamptz not null default now(),
  constraint valid_broadcast_target check (target_audience in ('ALL', 'COACHES', 'CODERS')),
  constraint valid_broadcast_status check (status in ('PENDING', 'SENT', 'SCHEDULED', 'FAILED'))
);

create index broadcast_logs_sent_at_idx on public.broadcast_logs (sent_at desc);
create index broadcast_logs_status_idx on public.broadcast_logs (status);
