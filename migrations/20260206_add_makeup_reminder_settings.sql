-- Add makeup reminder settings to invoice_settings table
-- Run this migration on your Supabase database

ALTER TABLE invoice_settings 
ADD COLUMN IF NOT EXISTS enable_makeup_reminder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS makeup_reminder_h3 BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS makeup_reminder_h1 BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS makeup_reminder_message_template TEXT DEFAULT 'Halo Ayah/Bunda {parent_name},

Ingat ya, tugas susulan untuk {student_name} akan berakhir pada {due_date}.

Link tugas: {makeup_url}

Mohon dikerjakan sebelum deadline.
Terima kasih! 🙏';
