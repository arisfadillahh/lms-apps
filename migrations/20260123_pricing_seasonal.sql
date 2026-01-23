-- Migration: Add seasonal pricing support
-- Run this in Supabase SQL Editor

-- Add pricing_type column (WEEKLY = requires level, SEASONAL = standalone)
ALTER TABLE pricing 
ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'WEEKLY';

-- Add seasonal_name for seasonal pricing
ALTER TABLE pricing 
ADD COLUMN IF NOT EXISTS seasonal_name TEXT;

-- Make level_id nullable for SEASONAL pricing
ALTER TABLE pricing 
ALTER COLUMN level_id DROP NOT NULL;

-- Update existing records to have WEEKLY as default type
UPDATE pricing SET pricing_type = 'WEEKLY' WHERE pricing_type IS NULL;

-- Create index for pricing type queries
CREATE INDEX IF NOT EXISTS idx_pricing_type ON pricing(pricing_type);

-- Comment
COMMENT ON COLUMN pricing.pricing_type IS 'Type of pricing: WEEKLY (regular with level) or SEASONAL (standalone seasonal programs)';
COMMENT ON COLUMN pricing.seasonal_name IS 'Name of seasonal program (only for SEASONAL type)';
