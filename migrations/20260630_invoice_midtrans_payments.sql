-- Midtrans payment method selection for public LMS invoices.
-- Keeps the existing invoice as the source of truth while preserving every
-- Midtrans order attempt for callback lookup and auditability.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_method_label text,
  ADD COLUMN IF NOT EXISTS payment_base_amount integer,
  ADD COLUMN IF NOT EXISTS payment_admin_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_total_amount integer,
  ADD COLUMN IF NOT EXISTS selected_payment_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS midtrans_order_id text,
  ADD COLUMN IF NOT EXISTS midtrans_transaction_id text,
  ADD COLUMN IF NOT EXISTS midtrans_payment_type text,
  ADD COLUMN IF NOT EXISTS midtrans_transaction_status text,
  ADD COLUMN IF NOT EXISTS midtrans_payment_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS midtrans_raw_response jsonb,
  ADD COLUMN IF NOT EXISTS midtrans_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.invoice_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  order_id text NOT NULL UNIQUE,
  payment_method text NOT NULL,
  payment_method_label text NOT NULL,
  base_amount integer NOT NULL CHECK (base_amount >= 0),
  admin_fee integer NOT NULL DEFAULT 0 CHECK (admin_fee >= 0),
  total_amount integer NOT NULL CHECK (total_amount >= 0),
  midtrans_transaction_id text,
  midtrans_payment_type text,
  midtrans_transaction_status text,
  payment_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_response jsonb,
  notification_payload jsonb,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_payment_attempts_invoice_idx
  ON public.invoice_payment_attempts (invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS invoice_payment_attempts_order_idx
  ON public.invoice_payment_attempts (order_id);

CREATE INDEX IF NOT EXISTS invoices_midtrans_order_idx
  ON public.invoices (midtrans_order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_selected_payment_attempt_fkey'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_selected_payment_attempt_fkey
      FOREIGN KEY (selected_payment_attempt_id)
      REFERENCES public.invoice_payment_attempts(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE TRIGGER trg_invoice_payment_attempts_updated_at
BEFORE UPDATE ON public.invoice_payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
