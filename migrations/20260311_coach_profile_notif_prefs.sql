-- Migration: Add coach profile extended fields and notification preferences
-- Run this in Supabase SQL editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS coach_bio TEXT,
  ADD COLUMN IF NOT EXISTS coach_skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notif_new_class BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_leave_update BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_session_reminder BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.coach_bio IS 'Bio singkat coach untuk ditampilkan di profil';
COMMENT ON COLUMN users.coach_skills IS 'Daftar bidang keahlian coach (array of strings)';
COMMENT ON COLUMN users.notif_new_class IS 'Coach ingin notifikasi ketika ada kelas baru';
COMMENT ON COLUMN users.notif_leave_update IS 'Coach ingin notifikasi ketika ada update pengajuan izin';
COMMENT ON COLUMN users.notif_session_reminder IS 'Coach ingin notifikasi pengingat sebelum sesi dimulai';
