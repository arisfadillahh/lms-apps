-- Migration: Modify Coder Reports to Support Per-Criteria AI Descriptions
-- Run this in Supabase SQL editor

-- 1. Remove the global `ai_description` from `block_reports`
ALTER TABLE public.block_reports DROP COLUMN IF EXISTS ai_description;

-- 2. DANGEROUS: Force drop the new child table to clear the cache issue!
DROP TABLE IF EXISTS public.block_report_descriptions CASCADE;

-- 3. Create the child table `block_report_descriptions` WITH the score column
CREATE TABLE public.block_report_descriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES public.block_reports(id) ON DELETE CASCADE,
    criteria_id UUID NOT NULL REFERENCES public.evaluation_criteria(id) ON DELETE CASCADE,
    score NUMERIC(4,2),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(report_id, criteria_id)
);

-- 3. Add updated_at trigger for block_report_descriptions
CREATE OR REPLACE FUNCTION public.set_block_report_descriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_block_report_descriptions_timestamp
BEFORE UPDATE ON public.block_report_descriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_block_report_descriptions_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.block_report_descriptions ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
CREATE POLICY "Admins and Coaches can manage block_report_descriptions" ON public.block_report_descriptions FOR ALL USING (auth.jwt() ->> 'role' IN ('ADMIN', 'COACH'));
CREATE POLICY "Coders can read their own block_report_descriptions via report status" ON public.block_report_descriptions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.block_reports br
    WHERE br.id = block_report_descriptions.report_id
    AND br.coder_id = auth.uid()
    AND br.status = 'PUBLISHED'
  )
);
