-- ============================================================================
-- Invoice System Migration
-- Run this script in Supabase SQL Editor
-- ============================================================================

-- 1. Create enum for invoice status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_enum') THEN
    CREATE TYPE public.invoice_status_enum AS ENUM ('PENDING', 'PAID', 'OVERDUE');
  END IF;
END
$$;

-- 2. Invoice Settings (Global Configuration)
CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generate_day integer NOT NULL DEFAULT 15 CHECK (generate_day >= 1 AND generate_day <= 28),
  due_days integer NOT NULL DEFAULT 10 CHECK (due_days >= 1),
  bank_name text NOT NULL DEFAULT '',
  bank_account_number text NOT NULL DEFAULT '',
  bank_account_holder text NOT NULL DEFAULT '',
  admin_whatsapp_number text NOT NULL DEFAULT '',
  base_url text NOT NULL DEFAULT 'http://localhost:3000',
  invoice_message_template text NOT NULL DEFAULT 'Yth. Bpk/Ibu {parent_name},

Tagihan kursus telah tersedia:

📄 Invoice: {invoice_number}
💰 Total: Rp {total_amount}
📅 Jatuh Tempo: {due_date}

Lihat detail:
{invoice_url}

Terima kasih 🙏
CLEVIO Coder',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default settings if not exists
INSERT INTO public.invoice_settings (id) 
SELECT gen_random_uuid() 
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_settings);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER trg_invoice_settings_updated_at
BEFORE UPDATE ON public.invoice_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 3. CCR Numbers (Customer Reference Numbers)
CREATE TABLE IF NOT EXISTS public.ccr_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_phone text NOT NULL UNIQUE,
  ccr_sequence integer NOT NULL,
  parent_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sequence for CCR auto-increment
CREATE SEQUENCE IF NOT EXISTS public.ccr_sequence_seq START 1;

-- Function to get next CCR sequence
CREATE OR REPLACE FUNCTION public.get_next_ccr_sequence()
RETURNS integer AS $$
BEGIN
  RETURN nextval('public.ccr_sequence_seq');
END;
$$ LANGUAGE plpgsql;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS ccr_numbers_parent_phone_idx ON public.ccr_numbers (parent_phone);

-- 4. Invoices (Header)
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  ccr_id uuid NOT NULL REFERENCES public.ccr_numbers(id) ON DELETE RESTRICT,
  parent_phone text NOT NULL,
  parent_name text NOT NULL,
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year integer NOT NULL CHECK (period_year >= 2020),
  total_amount integer NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status public.invoice_status_enum NOT NULL DEFAULT 'PENDING',
  due_date date NOT NULL,
  paid_at timestamptz,
  paid_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ccr_id, period_month, period_year)
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_period_idx ON public.invoices (period_year, period_month);
CREATE INDEX IF NOT EXISTS invoices_parent_phone_idx ON public.invoices (parent_phone);

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 5. Invoice Items (Line Items per Child)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  coder_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  coder_name text NOT NULL,
  class_name text NOT NULL,
  level_name text NOT NULL,
  base_price integer NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  discount_amount integer NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_price integer NOT NULL DEFAULT 0 CHECK (final_price >= 0),
  payment_period_id uuid REFERENCES public.coder_payment_periods(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for invoice items
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_items_coder_id_idx ON public.invoice_items (coder_id);

-- 6. Add whatsapp_session table for wwebjs session storage (optional - if not using file-based)
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  session_data jsonb,
  is_connected boolean NOT NULL DEFAULT false,
  connected_phone text,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE TRIGGER trg_whatsapp_sessions_updated_at
BEFORE UPDATE ON public.whatsapp_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 7. Add INVOICE category to whatsapp_message_logs if using existing enum
-- First check if enum value exists, if not add it
DO $$
BEGIN
  -- Check if INVOICE already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.whatsapp_category_enum'::regtype 
    AND enumlabel = 'INVOICE'
  ) THEN
    ALTER TYPE public.whatsapp_category_enum ADD VALUE 'INVOICE';
  END IF;
END
$$;

-- ============================================================================
-- Summary of Created Objects:
-- ============================================================================
-- Tables:
--   - invoice_settings (global config)
--   - ccr_numbers (customer reference numbers)
--   - invoices (invoice headers)
--   - invoice_items (line items per child)
--   - whatsapp_sessions (wwebjs session storage)
--
-- Enums:
--   - invoice_status_enum (PENDING, PAID, OVERDUE)
--
-- Sequences:
--   - ccr_sequence_seq (auto-increment for CCR numbers)
--
-- Functions:
--   - get_next_ccr_sequence() (get next CCR number)
-- ============================================================================
