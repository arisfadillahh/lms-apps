-- ============================================================================
-- Add Invoice Period Dates Migration
-- Adds period_start_date and period_end_date to track actual learning periods
-- ============================================================================

-- Add period date columns to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS period_start_date DATE,
ADD COLUMN IF NOT EXISTS period_end_date DATE;

-- Add index for period date queries
CREATE INDEX IF NOT EXISTS invoices_period_dates_idx 
ON public.invoices (period_start_date, period_end_date);

-- Add comments explaining the fields
COMMENT ON COLUMN public.invoices.period_start_date IS 'Start date of student learning period (actual period being paid for)';
COMMENT ON COLUMN public.invoices.period_end_date IS 'End date of student learning period (actual period being paid for)';

-- Note: period_month and period_year are kept for backward compatibility and filtering
COMMENT ON COLUMN public.invoices.period_month IS 'Month of invoice generation (kept for filtering/grouping)';
COMMENT ON COLUMN public.invoices.period_year IS 'Year of invoice generation (kept for filtering/grouping)';
