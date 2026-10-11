begin;
set local lock_timeout = '5s';

alter table public.trial_class_submissions
  add column if not exists domicile text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.trial_class_submissions'::regclass
      and conname = 'trial_class_submissions_domicile_length'
  ) then
    alter table public.trial_class_submissions
      add constraint trial_class_submissions_domicile_length
      check (domicile is null or char_length(btrim(domicile)) between 2 and 160);
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
