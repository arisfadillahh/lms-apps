-- Migration: Fix Invoice Constraint to allow multiple REGISTRATION/SEASONAL invoices per month
-- Date: 2026-02-04
-- Author: Assistant

-- 1. Drop the existing STRICT unique constraint
-- This constraint prevents creating multiple invoices for the same CCR in the same month
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_ccr_id_period_month_period_year_key;

-- 2. Create a NEW PARTIAL unique index
-- This enforces uniqueness ONLY for 'MONTHLY' invoices.
-- REGISTRATION and SEASONAL invoices will now be allowed to have duplicates for the same month/year.
CREATE UNIQUE INDEX invoices_monthly_unique_idx ON invoices (ccr_id, period_month, period_year)
WHERE invoice_type = 'MONTHLY';

-- 3. Verify (Optional comment)
-- The new index 'invoices_monthly_unique_idx' replaces the old constraint functionality 
-- but with a condition.
