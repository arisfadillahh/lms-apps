ALTER TABLE public.lesson_templates
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS lesson_templates_block_active_order_idx
  ON public.lesson_templates (block_id, is_archived, order_index);

COMMENT ON COLUMN public.lesson_templates.is_archived IS
  'Archived lessons are excluded from future planning but retained for historical sessions, reports, and make-up tasks.';

