-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  coder_id uuid NOT NULL,
  status USER-DEFINED NOT NULL,
  reason text,
  make_up_task_created boolean NOT NULL DEFAULT false,
  recorded_by uuid NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT attendance_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id)
);
CREATE TABLE public.block_software (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL,
  software_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT block_software_pkey PRIMARY KEY (id),
  CONSTRAINT block_software_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id),
  CONSTRAINT block_software_software_id_fkey FOREIGN KEY (software_id) REFERENCES public.software(id)
);
CREATE TABLE public.blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL,
  name text NOT NULL,
  summary text,
  order_index integer NOT NULL CHECK (order_index >= 0),
  estimated_sessions integer CHECK (estimated_sessions >= 0),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  software_id uuid,
  CONSTRAINT blocks_pkey PRIMARY KEY (id),
  CONSTRAINT blocks_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(id)
);
CREATE TABLE public.broadcast_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  content text NOT NULL,
  target_audience character varying NOT NULL DEFAULT 'ALL'::character varying CHECK (target_audience::text = ANY (ARRAY['ALL'::character varying, 'COACHES'::character varying, 'CODERS'::character varying]::text[])),
  sent_by uuid,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  total_recipients integer DEFAULT 0,
  successful_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  scheduled_for timestamp with time zone,
  status character varying NOT NULL DEFAULT 'SENT'::character varying CHECK (status::text = ANY (ARRAY['PENDING'::character varying, 'SENT'::character varying, 'SCHEDULED'::character varying, 'FAILED'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT broadcast_logs_pkey PRIMARY KEY (id),
  CONSTRAINT broadcast_logs_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id)
);
CREATE TABLE public.ccr_numbers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_phone text NOT NULL UNIQUE,
  ccr_sequence integer NOT NULL,
  parent_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ccr_code text NOT NULL,
  CONSTRAINT ccr_numbers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.class_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  block_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'UPCOMING'::class_block_status_enum,
  start_date date NOT NULL,
  end_date date NOT NULL,
  pitching_day_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT class_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT class_blocks_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT class_blocks_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id)
);
CREATE TABLE public.class_lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_block_id uuid NOT NULL,
  lesson_template_id uuid,
  title text NOT NULL,
  summary text,
  order_index integer NOT NULL CHECK (order_index >= 0),
  session_id uuid UNIQUE,
  unlock_at timestamp with time zone,
  make_up_instructions text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slide_url text,
  coach_example_url text,
  coach_example_storage_path text,
  CONSTRAINT class_lessons_pkey PRIMARY KEY (id),
  CONSTRAINT class_lessons_class_block_id_fkey FOREIGN KEY (class_block_id) REFERENCES public.class_blocks(id),
  CONSTRAINT class_lessons_lesson_template_id_fkey FOREIGN KEY (lesson_template_id) REFERENCES public.lesson_templates(id),
  CONSTRAINT class_lessons_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type USER-DEFINED NOT NULL,
  level_id uuid,
  coach_id uuid NOT NULL,
  schedule_day text NOT NULL,
  schedule_time time without time zone NOT NULL,
  zoom_link text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ekskul_lesson_plan_id uuid,
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(id),
  CONSTRAINT classes_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.users(id)
);
CREATE TABLE public.coach_leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  session_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'PENDING'::coach_leave_status_enum,
  note text,
  substitute_coach_id uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coach_leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT coach_leave_requests_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.users(id),
  CONSTRAINT coach_leave_requests_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT coach_leave_requests_substitute_coach_id_fkey FOREIGN KEY (substitute_coach_id) REFERENCES public.users(id),
  CONSTRAINT coach_leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id)
);
CREATE TABLE public.coaches (
  id bigint NOT NULL DEFAULT nextval('coaches_id_seq'::regclass),
  content text,
  metadata jsonb,
  embedding USER-DEFINED,
  CONSTRAINT coaches_pkey PRIMARY KEY (id)
);
CREATE TABLE public.coder_block_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coder_id uuid NOT NULL,
  block_id uuid NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  completed_by_admin boolean DEFAULT false,
  notes text,
  CONSTRAINT coder_block_completions_pkey PRIMARY KEY (id),
  CONSTRAINT coder_block_completions_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT coder_block_completions_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id)
);
CREATE TABLE public.coder_block_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coder_id uuid NOT NULL,
  level_id uuid NOT NULL,
  block_id uuid NOT NULL,
  journey_order integer NOT NULL CHECK (journey_order >= 0),
  status USER-DEFINED NOT NULL DEFAULT 'PENDING'::coder_block_status_enum,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coder_block_progress_pkey PRIMARY KEY (id),
  CONSTRAINT coder_block_progress_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT coder_block_progress_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(id),
  CONSTRAINT coder_block_progress_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id)
);
CREATE TABLE public.coder_payment_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coder_id uuid,
  class_id uuid,
  payment_plan_id uuid,
  pricing_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_amount numeric NOT NULL,
  status text DEFAULT 'ACTIVE'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coder_payment_periods_pkey PRIMARY KEY (id),
  CONSTRAINT coder_payment_periods_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT coder_payment_periods_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT coder_payment_periods_payment_plan_id_fkey FOREIGN KEY (payment_plan_id) REFERENCES public.payment_plans(id),
  CONSTRAINT coder_payment_periods_pricing_id_fkey FOREIGN KEY (pricing_id) REFERENCES public.pricing(id)
);
CREATE TABLE public.documents (
  id bigint NOT NULL DEFAULT nextval('documents_id_seq'::regclass),
  content text,
  metadata jsonb,
  embedding USER-DEFINED,
  CONSTRAINT documents_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ekskul_lesson_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  total_lessons integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ekskul_lesson_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ekskul_lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid,
  title text NOT NULL,
  summary text,
  slide_url text,
  example_url text,
  order_index integer NOT NULL,
  estimated_meetings integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ekskul_lessons_pkey PRIMARY KEY (id),
  CONSTRAINT ekskul_lessons_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.ekskul_lesson_plans(id)
);
CREATE TABLE public.ekskul_plan_software (
  plan_id uuid NOT NULL,
  software_id uuid NOT NULL,
  CONSTRAINT ekskul_plan_software_pkey PRIMARY KEY (plan_id, software_id),
  CONSTRAINT ekskul_plan_software_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.ekskul_lesson_plans(id),
  CONSTRAINT ekskul_plan_software_software_id_fkey FOREIGN KEY (software_id) REFERENCES public.software(id)
);
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  coder_id uuid NOT NULL,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  status USER-DEFINED NOT NULL DEFAULT 'ACTIVE'::enrollment_status_enum,
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT enrollments_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id)
);
CREATE TABLE public.exkul_session_competencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE,
  competencies jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exkul_session_competencies_pkey PRIMARY KEY (id),
  CONSTRAINT exkul_session_competencies_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);
CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  coder_id uuid NOT NULL,
  coder_name text NOT NULL,
  class_name text NOT NULL,
  level_name text NOT NULL,
  base_price integer NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  discount_amount integer NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  final_price integer NOT NULL DEFAULT 0 CHECK (final_price >= 0),
  payment_period_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invoice_items_pkey PRIMARY KEY (id),
  CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id),
  CONSTRAINT invoice_items_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT invoice_items_payment_period_id_fkey FOREIGN KEY (payment_period_id) REFERENCES public.coder_payment_periods(id)
);
CREATE TABLE public.invoice_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  generate_day integer NOT NULL DEFAULT 15 CHECK (generate_day >= 1 AND generate_day <= 28),
  due_days integer NOT NULL DEFAULT 10 CHECK (due_days >= 1),
  bank_name text NOT NULL DEFAULT ''::text,
  bank_account_number text NOT NULL DEFAULT ''::text,
  bank_account_holder text NOT NULL DEFAULT ''::text,
  admin_whatsapp_number text NOT NULL DEFAULT ''::text,
  base_url text NOT NULL DEFAULT 'http://localhost:3000'::text,
  invoice_message_template text NOT NULL DEFAULT 'Yth. Bpk/Ibu {parent_name},

Tagihan kursus telah tersedia:

📄 Invoice: {invoice_number}
💰 Total: Rp {total_amount}
📅 Jatuh Tempo: {due_date}

Lihat detail:
{invoice_url}

Terima kasih 🙏
CLEVIO Coder'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  whatsapp_delay_min integer NOT NULL DEFAULT 10,
  whatsapp_delay_max integer NOT NULL DEFAULT 30,
  registration_fee integer DEFAULT 150000,
  registration_fee_discount_percent integer DEFAULT 0,
  CONSTRAINT invoice_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  ccr_id uuid NOT NULL,
  parent_phone text NOT NULL,
  parent_name text NOT NULL,
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year integer NOT NULL CHECK (period_year >= 2020),
  total_amount integer NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status USER-DEFINED NOT NULL DEFAULT 'PENDING'::invoice_status_enum,
  due_date date NOT NULL,
  paid_at timestamp with time zone,
  paid_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  invoice_type character varying DEFAULT 'MONTHLY'::character varying,
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_ccr_id_fkey FOREIGN KEY (ccr_id) REFERENCES public.ccr_numbers(id)
);
CREATE TABLE public.knowledge_internal (
  id bigint NOT NULL DEFAULT nextval('knowledge_internal_id_seq'::regclass),
  content text,
  metadata jsonb,
  embedding USER-DEFINED,
  CONSTRAINT knowledge_internal_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lesson_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_template_id uuid,
  coach_id uuid,
  report_type text,
  description text,
  status text DEFAULT 'PENDING'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lesson_reports_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_reports_lesson_template_id_fkey FOREIGN KEY (lesson_template_id) REFERENCES public.lesson_templates(id),
  CONSTRAINT lesson_reports_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.users(id)
);
CREATE TABLE public.lesson_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL,
  title text NOT NULL,
  summary text,
  order_index integer NOT NULL CHECK (order_index >= 0),
  estimated_meeting_count integer CHECK (estimated_meeting_count >= 0),
  make_up_instructions text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  slide_url text,
  example_url text,
  example_storage_path text,
  CONSTRAINT lesson_templates_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_templates_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id)
);
CREATE TABLE public.levels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  order_index integer NOT NULL CHECK (order_index >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT levels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.make_up_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attendance_id uuid NOT NULL UNIQUE,
  coder_id uuid NOT NULL,
  session_id uuid NOT NULL,
  class_lesson_id uuid,
  due_date timestamp with time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'PENDING_UPLOAD'::make_up_status_enum,
  instructions text,
  submission_files jsonb,
  submitted_at timestamp with time zone,
  reviewed_by_coach_id uuid,
  reviewed_at timestamp with time zone,
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT make_up_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT make_up_tasks_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES public.attendance(id),
  CONSTRAINT make_up_tasks_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT make_up_tasks_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT make_up_tasks_class_lesson_id_fkey FOREIGN KEY (class_lesson_id) REFERENCES public.class_lessons(id),
  CONSTRAINT make_up_tasks_reviewed_by_coach_id_fkey FOREIGN KEY (reviewed_by_coach_id) REFERENCES public.users(id)
);
CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  session_id uuid,
  block_id uuid,
  title text NOT NULL,
  description text,
  file_url text,
  coach_note text,
  visible_from_session_id uuid,
  uploaded_by_user_id uuid NOT NULL,
  uploaded_by_role USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT materials_pkey PRIMARY KEY (id),
  CONSTRAINT materials_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT materials_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT materials_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id),
  CONSTRAINT materials_visible_from_session_id_fkey FOREIGN KEY (visible_from_session_id) REFERENCES public.sessions(id),
  CONSTRAINT materials_uploaded_by_user_id_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.n8n_chat_histories (
  id integer NOT NULL DEFAULT nextval('n8n_chat_histories_id_seq'::regclass),
  session_id character varying NOT NULL,
  message jsonb NOT NULL,
  CONSTRAINT n8n_chat_histories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  type character varying DEFAULT 'SYSTEM'::character varying,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.payment_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  duration_months integer NOT NULL,
  discount_percent numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payment_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid,
  level_id uuid,
  mode text NOT NULL DEFAULT 'WEEKLY'::text,
  amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT payment_pricing_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(id),
  CONSTRAINT payment_pricing_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.payment_plans(id)
);
CREATE TABLE public.payment_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_period_id uuid,
  reminder_type text NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'SENT'::text,
  CONSTRAINT payment_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT payment_reminders_payment_period_id_fkey FOREIGN KEY (payment_period_id) REFERENCES public.coder_payment_periods(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_period_id uuid,
  amount numeric NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  payment_method text,
  notes text,
  created_by uuid,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_payment_period_id_fkey FOREIGN KEY (payment_period_id) REFERENCES public.coder_payment_periods(id),
  CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.pitching_day_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rubric_submission_id uuid NOT NULL UNIQUE,
  pdf_url text NOT NULL,
  storage_path text NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_via_whatsapp boolean NOT NULL DEFAULT false,
  sent_to_parent_at timestamp with time zone,
  CONSTRAINT pitching_day_reports_pkey PRIMARY KEY (id),
  CONSTRAINT pitching_day_reports_rubric_submission_id_fkey FOREIGN KEY (rubric_submission_id) REFERENCES public.rubric_submissions(id)
);
CREATE TABLE public.pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level_id uuid,
  mode text NOT NULL,
  base_price_monthly numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pricing_pkey PRIMARY KEY (id),
  CONSTRAINT pricing_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(id)
);
CREATE TABLE public.rubric_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  coder_id uuid NOT NULL,
  block_id uuid,
  semester_tag text,
  rubric_template_id uuid NOT NULL,
  grades jsonb NOT NULL,
  positive_character_chosen ARRAY NOT NULL DEFAULT '{}'::text[],
  narrative text NOT NULL,
  submitted_by uuid NOT NULL,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status USER-DEFINED NOT NULL DEFAULT 'FINAL'::rubric_submission_status_enum,
  CONSTRAINT rubric_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT rubric_submissions_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT rubric_submissions_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT rubric_submissions_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id),
  CONSTRAINT rubric_submissions_rubric_template_id_fkey FOREIGN KEY (rubric_template_id) REFERENCES public.rubric_templates(id),
  CONSTRAINT rubric_submissions_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id)
);
CREATE TABLE public.rubric_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_type USER-DEFINED NOT NULL,
  level_id uuid,
  competencies jsonb NOT NULL,
  positive_characters ARRAY NOT NULL DEFAULT '{}'::text[],
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rubric_templates_pkey PRIMARY KEY (id),
  CONSTRAINT rubric_templates_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.levels(id),
  CONSTRAINT rubric_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  date_time timestamp with time zone NOT NULL,
  zoom_link_snapshot text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'SCHEDULED'::session_status_enum,
  substitute_coach_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ekskul_lesson_id uuid,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT sessions_substitute_coach_id_fkey FOREIGN KEY (substitute_coach_id) REFERENCES public.users(id)
);
CREATE TABLE public.software (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  version text,
  installation_url text,
  installation_instructions text,
  minimum_specs jsonb,
  access_info text,
  icon_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT software_pkey PRIMARY KEY (id)
);
CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  makeup_id uuid NOT NULL,
  session_id uuid NOT NULL,
  coder_id uuid NOT NULL,
  file_path text NOT NULL,
  file_type text,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  verdict text CHECK (verdict = ANY (ARRAY['APPROVED'::text, 'REJECTED'::text, 'NEEDS_REVISION'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT submissions_pkey PRIMARY KEY (id),
  CONSTRAINT submissions_makeup_id_fkey FOREIGN KEY (makeup_id) REFERENCES public.make_up_tasks(id),
  CONSTRAINT submissions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT submissions_coder_id_fkey FOREIGN KEY (coder_id) REFERENCES public.users(id),
  CONSTRAINT submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role USER-DEFINED NOT NULL,
  parent_contact_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  avatar_path text,
  birth_date date,
  gender text,
  school_name text,
  school_grade text,
  parent_name text,
  parent_email text,
  address text,
  notes text,
  referral_source text,
  admin_permissions jsonb,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.whatsapp_message_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category USER-DEFINED NOT NULL,
  payload jsonb NOT NULL,
  response jsonb,
  status USER-DEFINED NOT NULL DEFAULT 'QUEUED'::whatsapp_status_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT whatsapp_message_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.whatsapp_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  session_data jsonb,
  is_connected boolean NOT NULL DEFAULT false,
  connected_phone text,
  last_activity_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category character varying NOT NULL UNIQUE CHECK (category::text = ANY (ARRAY['PARENT_ABSENT'::character varying, 'REPORT_SEND'::character varying, 'REMINDER'::character varying]::text[])),
  template_content text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);