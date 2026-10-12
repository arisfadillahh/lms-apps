-- The application reads this table, but its original definition only lived in
-- migrations/20260417_coder_session_access.sql, outside Supabase CLI's path.
-- CREATE IF NOT EXISTS preserves installations that already ran the legacy SQL.
CREATE TABLE IF NOT EXISTS public.coder_session_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coder_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  granted_reason text NOT NULL DEFAULT 'SESSION_COMPLETED',
  granted_at timestamptz NOT NULL DEFAULT now(),
  source_enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS coder_session_access_coder_session_uidx
  ON public.coder_session_access (coder_id, session_id);
CREATE INDEX IF NOT EXISTS coder_session_access_coder_idx
  ON public.coder_session_access (coder_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS coder_session_access_class_idx
  ON public.coder_session_access (class_id, granted_at DESC);

ALTER TABLE public.coder_session_access ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.coder_session_access TO service_role;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coder_session_access'
      AND policyname = 'Service role manages coder session access'
  ) THEN
    CREATE POLICY "Service role manages coder session access"
      ON public.coder_session_access TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END;
$policy$;
