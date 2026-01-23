-- Migration: Allow nullable coder_id in invoice_items
-- Run this in Supabase SQL Editor

-- Make coder_id nullable to support seasonal invoices
ALTER TABLE invoice_items 
ALTER COLUMN coder_id DROP NOT NULL;

-- Add description column which is missing in the schema but used in logic
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN invoice_items.coder_id IS 'Link to users table. Can be NULL for seasonal invoices.';
COMMENT ON COLUMN invoice_items.description IS 'Optional description for custom or seasonal items.';
