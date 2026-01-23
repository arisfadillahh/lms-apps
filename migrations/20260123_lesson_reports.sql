-- Migration: Create lesson_reports table for coach feedback on lessons
-- Run this in Supabase SQL Editor

-- Create the lesson_reports table
CREATE TABLE IF NOT EXISTS lesson_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_template_id UUID NOT NULL REFERENCES lesson_templates(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('TOO_DIFFICULT', 'UNCLEAR', 'BUG', 'OUTDATED', 'OTHER')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_lesson_reports_status ON lesson_reports(status);
CREATE INDEX IF NOT EXISTS idx_lesson_reports_coach_id ON lesson_reports(coach_id);
CREATE INDEX IF NOT EXISTS idx_lesson_reports_lesson_template_id ON lesson_reports(lesson_template_id);
CREATE INDEX IF NOT EXISTS idx_lesson_reports_created_at ON lesson_reports(created_at DESC);

-- Enable RLS
ALTER TABLE lesson_reports ENABLE ROW LEVEL SECURITY;

-- Policies: Admin can do everything, Coach can only see their own reports
CREATE POLICY "Admins can do everything on lesson_reports"
    ON lesson_reports
    FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Coaches can view own lesson_reports"
    ON lesson_reports
    FOR SELECT
    TO authenticated
    USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert lesson_reports"
    ON lesson_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (coach_id = auth.uid());

-- Grant permissions
GRANT ALL ON lesson_reports TO authenticated;
GRANT ALL ON lesson_reports TO service_role;

-- Add comment
COMMENT ON TABLE lesson_reports IS 'Stores coach feedback/reports on lesson template issues';
