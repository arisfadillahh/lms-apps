-- Migration: Add SUBMITTED status to block_reports
-- Run this in Supabase SQL editor

-- 1. Add SUBMITTED to block_report_status_enum
ALTER TYPE block_report_status_enum ADD VALUE IF NOT EXISTS 'SUBMITTED';

-- (SENT sudah ada dari langkah sebelumnya, biarkan saja)

-- Context:
-- DRAFT: Coach sedang mengerjakan
-- SUBMITTED: Sudah dikirim ke Admin (Inbox Admin)
-- PUBLISHED: Admin sudah setujui & kirim WA (Final)
