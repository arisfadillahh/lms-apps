CREATE TABLE IF NOT EXISTS public.class_change_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('RECURRING_SCHEDULE_UPDATED', 'LESSON_REASSIGNED', 'HISTORY_RECONSTRUCTED')),
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  class_lesson_id uuid REFERENCES public.class_lessons(id) ON DELETE SET NULL,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_change_audit_logs_class_created
  ON public.class_change_audit_logs (class_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_class_change_audit_logs_session
  ON public.class_change_audit_logs (session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.class_change_audit_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.class_change_audit_logs IS
  'Immutable operational audit trail for Admin recurring-schedule and lesson-assignment changes.';

COMMENT ON COLUMN public.class_change_audit_logs.before_state IS
  'Snapshot immediately before the mutation; must not contain credentials or message payloads.';

COMMENT ON COLUMN public.class_change_audit_logs.after_state IS
  'Snapshot immediately after the mutation; must not contain credentials or message payloads.';
