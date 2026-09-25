ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS classes_active_list_idx
  ON public.classes (start_date)
  WHERE archived_at IS NULL;

COMMENT ON COLUMN public.classes.archived_at IS
  'Hides a closed class from operational class lists while retaining sessions, enrollments, reports, and billing history.';
