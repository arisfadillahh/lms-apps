alter table public.trial_class_submissions
  add column if not exists status text not null default 'PENDING',
  add column if not exists coach_id uuid references public.users(id) on delete set null,
  add column if not exists scheduled_at timestamptz,
  add column if not exists duration_minutes integer not null default 60,
  add column if not exists status_reason text,
  add column if not exists google_calendar_event_id text,
  add column if not exists google_meet_url text,
  add column if not exists assigned_at timestamptz,
  add column if not exists assigned_by uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trial_class_submissions_status_check'
      and conrelid = 'public.trial_class_submissions'::regclass
  ) then
    alter table public.trial_class_submissions
      add constraint trial_class_submissions_status_check
      check (status in ('PENDING', 'SCHEDULED', 'CANCELLED', 'FAILED'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trial_class_submissions_duration_check'
      and conrelid = 'public.trial_class_submissions'::regclass
  ) then
    alter table public.trial_class_submissions
      add constraint trial_class_submissions_duration_check
      check (duration_minutes between 30 and 180);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'trial_class_submissions_status_reason_length'
      and conrelid = 'public.trial_class_submissions'::regclass
  ) then
    alter table public.trial_class_submissions
      add constraint trial_class_submissions_status_reason_length
      check (status_reason is null or char_length(status_reason) <= 1000);
  end if;
end
$$;

create index if not exists trial_class_submissions_status_scheduled_at_idx
  on public.trial_class_submissions (status, scheduled_at);

create index if not exists trial_class_submissions_coach_id_idx
  on public.trial_class_submissions (coach_id);

drop trigger if exists trg_trial_class_submissions_updated_at on public.trial_class_submissions;
create trigger trg_trial_class_submissions_updated_at
  before update on public.trial_class_submissions
  for each row execute function public.set_updated_at_timestamp();

comment on column public.trial_class_submissions.status is
  'Trial workflow state: PENDING, SCHEDULED, CANCELLED, or FAILED.';
comment on column public.trial_class_submissions.status_reason is
  'Required admin reason when a trial is cancelled or marked as failed.';
comment on column public.trial_class_submissions.google_calendar_event_id is
  'Google Calendar event ID used to update or cancel an online trial meeting.';
