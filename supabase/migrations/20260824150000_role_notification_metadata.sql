ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS category varchar(40) NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS priority varchar(12) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS dedupe_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_action_url_internal_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_action_url_internal_check
      CHECK (action_url IS NULL OR (action_url LIKE '/%' AND action_url NOT LIKE '//%'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_priority_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_priority_check
      CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON public.notifications (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe_key
  ON public.notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
