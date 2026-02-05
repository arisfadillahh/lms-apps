-- Add Class Reminder Settings to invoice_settings table
ALTER TABLE invoice_settings 
ADD COLUMN IF NOT EXISTS enable_class_reminder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS class_reminder_time TEXT DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS class_reminder_message_template TEXT DEFAULT 'Halo Kak {parent_name},

Mengingatkan kembali bahwa hari ini ada jadwal kelas untuk:
{student_name}

Jam: {time}
Di: {zoom_link}

Harap hadir tepat waktu ya. Terima kasih!',
ADD COLUMN IF NOT EXISTS class_reminder_delay_min INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS class_reminder_delay_max INTEGER DEFAULT 15;
