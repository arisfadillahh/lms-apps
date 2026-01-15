-- =====================================================
-- LMS IMPROVEMENTS SQL MIGRATION
-- Run this SQL in your Supabase SQL Editor
-- =====================================================

-- 1. WhatsApp Templates Table
-- Stores customizable message templates for different notification categories
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL UNIQUE,
    template_content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add check constraint for valid categories
ALTER TABLE whatsapp_templates 
ADD CONSTRAINT valid_whatsapp_template_category 
CHECK (category IN ('PARENT_ABSENT', 'REPORT_SEND', 'REMINDER'));

-- Index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON whatsapp_templates(category);

-- 2. Broadcast Logs Table
-- Stores history of broadcast messages sent by admin
CREATE TABLE IF NOT EXISTS broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    target_audience VARCHAR(50) NOT NULL DEFAULT 'ALL',
    sent_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_recipients INTEGER DEFAULT 0,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    scheduled_for TIMESTAMPTZ, -- NULL means sent immediately
    status VARCHAR(50) NOT NULL DEFAULT 'SENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add check constraints
ALTER TABLE broadcast_logs 
ADD CONSTRAINT valid_broadcast_target 
CHECK (target_audience IN ('ALL', 'COACHES', 'CODERS'));

ALTER TABLE broadcast_logs 
ADD CONSTRAINT valid_broadcast_status 
CHECK (status IN ('PENDING', 'SENT', 'SCHEDULED', 'FAILED'));

-- Index for listing broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_sent_at ON broadcast_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_status ON broadcast_logs(status);

-- 3. Insert default WhatsApp templates (if not exist)
INSERT INTO whatsapp_templates (category, template_content, variables)
VALUES 
    ('PARENT_ABSENT', 
     'Halo Bapak/Ibu, kami informasikan bahwa {nama_siswa} tidak hadir pada kelas {nama_kelas} hari ini ({tanggal}). Mohon segera mengerjakan tugas susulan. Terima kasih.',
     '["nama_siswa", "nama_kelas", "tanggal"]'::jsonb),
    ('REPORT_SEND',
     'Halo Bapak/Ibu, berikut adalah rapor {nama_siswa} untuk periode {periode}. Silakan unduh dan simpan sebagai dokumentasi. Terima kasih atas kepercayaan Anda.',
     '["nama_siswa", "periode"]'::jsonb),
    ('REMINDER',
     'Halo Bapak/Ibu, ini adalah pengingat pembayaran untuk {nama_siswa}. Tagihan sebesar {nominal} akan jatuh tempo pada {tanggal_jatuh_tempo}. Mohon segera melakukan pembayaran. Terima kasih.',
     '["nama_siswa", "nominal", "tanggal_jatuh_tempo"]'::jsonb)
ON CONFLICT (category) DO NOTHING;

-- 5. RLS Policies for new tables
-- WhatsApp Templates - Admin only
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage whatsapp templates" ON whatsapp_templates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Broadcast Logs - Admin only
ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage broadcast logs" ON broadcast_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- =====================================================
-- SUMMARY OF CHANGES
-- =====================================================
-- 1. Created whatsapp_templates table for customizable message templates
-- 2. Created broadcast_logs table for tracking broadcast history
-- 3. Inserted default WhatsApp templates
-- 4. Added RLS policies for new tables
-- =====================================================
