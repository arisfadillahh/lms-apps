create table if not exists public.trial_class_submissions (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  student_grade text not null,
  school_name text not null,
  parent_name text not null,
  phone text not null,
  email text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint trial_class_submissions_student_name_length check (char_length(student_name) between 2 and 120),
  constraint trial_class_submissions_student_grade_length check (char_length(student_grade) between 1 and 50),
  constraint trial_class_submissions_school_name_length check (char_length(school_name) between 2 and 160),
  constraint trial_class_submissions_parent_name_length check (char_length(parent_name) between 2 and 120),
  constraint trial_class_submissions_phone_length check (char_length(phone) between 9 and 20),
  constraint trial_class_submissions_email_length check (char_length(email) between 3 and 254),
  constraint trial_class_submissions_notes_length check (notes is null or char_length(notes) <= 1000)
);

create index if not exists trial_class_submissions_created_at_idx
  on public.trial_class_submissions (created_at desc);

alter table public.trial_class_submissions enable row level security;

comment on table public.trial_class_submissions is
  'Free trial class leads submitted through the public LMS form. Accessed server-side with the service role.';
