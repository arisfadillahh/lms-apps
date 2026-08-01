alter table public.ekskul_lessons
  add column if not exists make_up_instructions text;

comment on column public.ekskul_lessons.make_up_instructions is
  'Admin-defined task instructions automatically copied into make_up_tasks when an ekskul student is absent or excused for this lesson.';
