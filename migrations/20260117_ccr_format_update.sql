-- ============================================================================
-- CCR System Update Migration
-- Run this AFTER the initial invoice_system migration
-- ============================================================================

-- 1. Update ccr_numbers table to store CCR code directly
ALTER TABLE public.ccr_numbers 
ADD COLUMN IF NOT EXISTS ccr_code text;

-- 2. Create function to format CCR code (new format: CCR001, CCR017, etc.)
CREATE OR REPLACE FUNCTION public.format_ccr_code(seq integer)
RETURNS text AS $$
BEGIN
  RETURN 'CCR' || LPAD(seq::text, 3, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Update existing CCR records with formatted code
UPDATE public.ccr_numbers 
SET ccr_code = public.format_ccr_code(ccr_sequence)
WHERE ccr_code IS NULL;

-- 4. Make ccr_code unique and not null
ALTER TABLE public.ccr_numbers 
ALTER COLUMN ccr_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ccr_numbers_ccr_code_key ON public.ccr_numbers (ccr_code);

-- 5. Add function to get next available CCR code
CREATE OR REPLACE FUNCTION public.get_next_ccr_code()
RETURNS text AS $$
DECLARE
  max_seq integer;
  next_code text;
BEGIN
  SELECT COALESCE(MAX(ccr_sequence), 0) INTO max_seq FROM public.ccr_numbers;
  next_code := public.format_ccr_code(max_seq + 1);
  RETURN next_code;
END;
$$ LANGUAGE plpgsql;

-- 6. Add function to validate CCR code format
CREATE OR REPLACE FUNCTION public.validate_ccr_code(code text)
RETURNS boolean AS $$
BEGIN
  RETURN code ~ '^CCR[0-9]{3,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Add function to extract sequence from CCR code
CREATE OR REPLACE FUNCTION public.extract_ccr_sequence(code text)
RETURNS integer AS $$
BEGIN
  IF NOT public.validate_ccr_code(code) THEN
    RETURN NULL;
  END IF;
  RETURN CAST(SUBSTRING(code FROM 4) AS integer);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Summary:
-- - CCR code format: CCR001, CCR017, CCR025 (no dash)
-- - Invoice number format: CCR017-042024 (CCR + MMYYYY)
-- - Functions: format_ccr_code, get_next_ccr_code, validate_ccr_code
-- ============================================================================
