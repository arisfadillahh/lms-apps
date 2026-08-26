-- Keep coder program independent from the optional parent WhatsApp number.
-- Nullable is intentional so existing users remain compatible until their
-- program is confirmed by an admin or an active class enrollment.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coder_program text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_coder_program_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_coder_program_check
      CHECK (coder_program IS NULL OR coder_program IN ('WEEKLY', 'EKSKUL'));
  END IF;
END $$;

COMMENT ON COLUMN public.users.coder_program IS
  'Program coder yang dipilih admin; tidak ditentukan dari nomor WhatsApp.';
