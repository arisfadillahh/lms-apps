alter table public.trial_class_submissions
  add column if not exists trial_mode text not null default 'ONLINE';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trial_class_submissions_trial_mode_check'
      and conrelid = 'public.trial_class_submissions'::regclass
  ) then
    alter table public.trial_class_submissions
      add constraint trial_class_submissions_trial_mode_check
      check (trial_mode in ('ONLINE', 'OFFLINE'));
  end if;
end
$$;

comment on column public.trial_class_submissions.trial_mode is
  'Selected delivery mode for the free trial: ONLINE or OFFLINE.';
