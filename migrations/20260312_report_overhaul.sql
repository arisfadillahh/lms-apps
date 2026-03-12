-- Migration: Coder Report Overhaul
-- Run this in Supabase SQL editor

-- 1. evaluation_criteria
CREATE TABLE IF NOT EXISTS public.evaluation_criteria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Initial Criteria
INSERT INTO public.evaluation_criteria (name, description, order_index) VALUES
('Logika Pemrograman', 'Kemampuan memahami dan mengaplikasikan konsep dasar pemrograman seperti urutan, percabangan, dan perulangan.', 1),
('Kreativitas', 'Kemampuan untuk bereksperimen dengan elemen desain atau memodifikasi program di luar instruksi dasar.', 2),
('Pemecahan Masalah (Problem Solving)', 'Kemampuan menemukan, mengidentifikasi, dan memperbaiki bug atau kesalahan dalam kode secara mandiri.', 3),
('Pemahaman Konsep', 'Tingkat penguasaan dan pemahaman terhadap materi baru yang diajarkan pada lesson tersebut.', 4),
('Kemampuan Berkolaborasi & Komunikasi', 'Bagaimana anak berinteraksi, bertanya, atau membantu teman sebaya serta komunikasi yang baik dengan coach.', 5);

-- 2. lesson_evaluations
CREATE TABLE IF NOT EXISTS public.lesson_evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    coder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    criteria_id UUID NOT NULL REFERENCES public.evaluation_criteria(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(session_id, coder_id, criteria_id)
);

-- 3. block_reports
CREATE TYPE block_report_status_enum AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE IF NOT EXISTS public.block_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
    coder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status block_report_status_enum NOT NULL DEFAULT 'DRAFT',
    average_score NUMERIC,
    grade VARCHAR(2),
    ai_description TEXT,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    sent_via_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, block_id, coder_id)
);

-- Add updated_at trigger for block_reports
CREATE OR REPLACE FUNCTION public.set_block_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_block_reports_timestamp
BEFORE UPDATE ON public.block_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_block_reports_updated_at();

-- RLS Policies
ALTER TABLE public.evaluation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_reports ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage evaluation_criteria" ON public.evaluation_criteria FOR ALL USING (auth.jwt() ->> 'role' = 'ADMIN');
CREATE POLICY "Anyone can read evaluation_criteria" ON public.evaluation_criteria FOR SELECT USING (true); 

CREATE POLICY "Admins and Coaches can manage lesson_evaluations" ON public.lesson_evaluations FOR ALL USING (auth.jwt() ->> 'role' IN ('ADMIN', 'COACH'));
CREATE POLICY "Coders can read their own lesson_evaluations" ON public.lesson_evaluations FOR SELECT USING (auth.uid() = coder_id);

CREATE POLICY "Admins and Coaches can manage block_reports" ON public.block_reports FOR ALL USING (auth.jwt() ->> 'role' IN ('ADMIN', 'COACH'));
CREATE POLICY "Coders can read their own published block_reports" ON public.block_reports FOR SELECT USING (auth.uid() = coder_id AND status = 'PUBLISHED');
