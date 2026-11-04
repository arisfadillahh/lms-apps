-- Isolated development/test fixtures only. Never run against a live Supabase DB.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.users (
 id uuid PRIMARY KEY, username text UNIQUE NOT NULL, password_hash text NOT NULL DEFAULT '', full_name text NOT NULL,
 role text NOT NULL, is_active boolean NOT NULL DEFAULT true, parent_contact_phone text, admin_permissions jsonb,
 avatar_path text, coder_program text, birth_date date, gender text, school_name text, school_grade text,
 parent_name text, parent_email text, address text, notes text, referral_source text,
 coach_bio text, coach_skills jsonb, notif_new_class boolean, notif_leave_update boolean, notif_session_reminder boolean,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.classes (
 id uuid PRIMARY KEY, name text NOT NULL, type text NOT NULL, coach_id uuid REFERENCES users(id),
 delivery_mode text DEFAULT 'ONLINE', schedule_day text DEFAULT 'MONDAY', schedule_time text DEFAULT '16:00',
 level_id uuid, ekskul_lesson_plan_id uuid, zoom_link text DEFAULT 'https://meet.google.com/local-demo',
 location_name text, location_address text, location_maps_url text, archived_at timestamptz,
 lifecycle_status text DEFAULT 'ACTIVE', start_date date DEFAULT CURRENT_DATE, end_date date DEFAULT CURRENT_DATE + 90,
 parent_whatsapp_enabled boolean DEFAULT false, parent_whatsapp_class_reminder_enabled boolean DEFAULT false,
 parent_whatsapp_absence_enabled boolean DEFAULT false, parent_whatsapp_makeup_enabled boolean DEFAULT false,
 parent_whatsapp_report_enabled boolean DEFAULT false, parent_whatsapp_event_enabled boolean DEFAULT false,
 created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.sessions (id uuid PRIMARY KEY, class_id uuid REFERENCES classes(id), date_time timestamptz, status text, substitute_coach_id uuid REFERENCES users(id), zoom_link_snapshot text DEFAULT '', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.enrollments (id uuid PRIMARY KEY, class_id uuid REFERENCES classes(id), coder_id uuid REFERENCES users(id), enrolled_at timestamptz, ended_at timestamptz, status text, exit_reason text, updated_at timestamptz DEFAULT now());
CREATE TABLE public.coach_leave_requests (id uuid PRIMARY KEY, coach_id uuid REFERENCES users(id), session_id uuid REFERENCES sessions(id), status text, substitute_coach_id uuid REFERENCES users(id), note text, approved_by uuid REFERENCES users(id), approved_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE public.trial_class_submissions (id uuid PRIMARY KEY, student_name text, phone text, trial_mode text, status text, coach_id uuid REFERENCES users(id), scheduled_at timestamptz, duration_minutes integer DEFAULT 60);
CREATE TABLE public.trial_assessments (id uuid PRIMARY KEY, trial_id uuid REFERENCES trial_class_submissions(id), coach_id uuid REFERENCES users(id), status text, invoice_id uuid, submitted_at timestamptz, payment_confirmed_at timestamptz, coder_id uuid);
CREATE TABLE public.invoices (id uuid PRIMARY KEY, status text);
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), title text, message text, type text, is_read boolean DEFAULT false, action_url text, category text, priority text, dedupe_key text, created_at timestamptz DEFAULT now(), UNIQUE(user_id,dedupe_key));
CREATE TABLE public.push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, endpoint text, p256dh text, auth text, is_active boolean DEFAULT true);
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
