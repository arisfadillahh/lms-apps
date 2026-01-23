-- Migration: Add seasonal invoice support
-- Run this in Supabase SQL Editor

-- Make ccr_id nullable to support seasonal invoices (no coder-class relationship)
ALTER TABLE invoices 
ALTER COLUMN ccr_id DROP NOT NULL;

-- Add columns for seasonal invoices (students without coder accounts)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS seasonal_student_name TEXT,
ADD COLUMN IF NOT EXISTS seasonal_student_phone TEXT;

-- Add SEASONAL to invoice_type if it's an enum, or just use it as a value
-- Note: invoice_type column should already exist in the table

-- Create index for querying seasonal invoices (using invoice_type column)
CREATE INDEX IF NOT EXISTS idx_invoices_seasonal ON invoices(invoice_type) WHERE invoice_type = 'SEASONAL';

-- Comment
COMMENT ON COLUMN invoices.seasonal_student_name IS 'Student name for seasonal invoices (no coder account)';
COMMENT ON COLUMN invoices.seasonal_student_phone IS 'Parent WhatsApp for seasonal invoices';
 POST /api/admin/invoices/seasonal 500 in 228ms (compile: 2ms, render: 225ms)
[Seasonal Invoice] Error: {
  code: '23502',
  details: 'Failing row contains (cc16e0a0-7bd7-4dbb-938d-423853727b77, SEA-2026-0001, null, 123123123123123, test qweqweqwe, 1, 2026, 335000, PENDING, 2026-02-22, null, null, 2026-01-23 03:46:09.178579+00, 2026-01-23 03:46:09.178579+00, SEASONAL, test qweqweqwe, 123123123123123).',
  hint: null,
  message: 'null value in column "ccr_id" of relation "invoices" violates not-null constraint'
}
 POST /api/admin/invoices/seasonal 500 in 184ms (compile: 1637µs, render: 182ms)
 GET /api/notifications 200 in 139ms (compile: 1643µs, render: 137ms)