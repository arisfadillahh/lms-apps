-- ============================================================
-- Block Evaluation Feature Migration
-- Run this in your Supabase SQL editor
-- ============================================================

-- Table 1: block_evaluation_templates
-- Stores the reflection form questions per level
CREATE TABLE IF NOT EXISTS public.block_evaluation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id UUID REFERENCES public.levels(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 2: block_evaluations
-- Stores the answers submitted by each coder at end of block
CREATE TABLE IF NOT EXISTS public.block_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.block_evaluation_templates(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coder_id, block_id)
);

-- RLS Policies
ALTER TABLE public.block_evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_evaluations ENABLE ROW LEVEL SECURITY;

-- Allow coders to read templates
DROP POLICY IF EXISTS "Coders can read evaluation templates" ON public.block_evaluation_templates;
CREATE POLICY "Coders can read evaluation templates"
  ON public.block_evaluation_templates
  FOR SELECT
  USING (true);

-- Allow coders to insert their own evaluations
DROP POLICY IF EXISTS "Coders can insert own evaluations" ON public.block_evaluations;
CREATE POLICY "Coders can insert own evaluations"
  ON public.block_evaluations
  FOR INSERT
  WITH CHECK (auth.uid() = coder_id);

-- Allow coders to read their own evaluations
DROP POLICY IF EXISTS "Coders can read own evaluations" ON public.block_evaluations;
CREATE POLICY "Coders can read own evaluations"
  ON public.block_evaluations
  FOR SELECT
  USING (auth.uid() = coder_id);

-- Allow admins/coaches to read all evaluations (service role bypasses RLS)
-- The app uses getSupabaseAdmin() so this is handled by service_role key

-- ============================================================
-- Real-time Coach-Led Evaluation: Session Control Tables
-- ============================================================

-- Table 3: block_evaluation_sessions
-- Coach creates one per session. Tracks current question and status.
CREATE TABLE IF NOT EXISTS public.block_evaluation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.block_evaluation_templates(id) ON DELETE SET NULL,
  current_question_index INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',  -- 'waiting' | 'in_progress' | 'completed'
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id)
);

ALTER TABLE public.block_evaluation_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (coder/coach) – service role used by coaches to update  
DROP POLICY IF EXISTS "Anyone can read eval sessions" ON public.block_evaluation_sessions;
CREATE POLICY "Anyone can read eval sessions"
  ON public.block_evaluation_sessions
  FOR SELECT
  USING (true);

-- Coaches create/update via service role (bypasses RLS)


-- Table 4: block_evaluation_answers
-- Stores one row per coder per question (answers submitted one at a time)
CREATE TABLE IF NOT EXISTS public.block_evaluation_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_session_id UUID NOT NULL REFERENCES public.block_evaluation_sessions(id) ON DELETE CASCADE,
  coder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_index INT NOT NULL,
  answer TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(eval_session_id, coder_id, question_id)
);

ALTER TABLE public.block_evaluation_answers ENABLE ROW LEVEL SECURITY;

-- Coders insert their own answers
DROP POLICY IF EXISTS "Coders insert own answers" ON public.block_evaluation_answers;
CREATE POLICY "Coders insert own answers"
  ON public.block_evaluation_answers
  FOR INSERT
  WITH CHECK (auth.uid() = coder_id);

-- Anyone can read (coach needs to see who answered)
DROP POLICY IF EXISTS "Anyone can read answers" ON public.block_evaluation_answers;
CREATE POLICY "Anyone can read answers"
  ON public.block_evaluation_answers
  FOR SELECT
  USING (true);

-- Enable Supabase Realtime for these tables
-- (run in Supabase dashboard under Realtime > Tables if not auto-enabled)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.block_evaluation_sessions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.block_evaluation_answers;

-- Optional: Seed default questions (no level restriction = fallback)
/*
INSERT INTO public.block_evaluation_templates (level_id, questions)
VALUES (
  null,
  '[
    {"id": "q1", "question": "Apa hal baru yang paling kamu sukai dari block ini?", "hint": "Ceritakan hal yang paling seru atau menarik buatmu!", "placeholder": "Aku suka waktu belajar..."},
    {"id": "q2", "question": "Di bagian mana kamu merasa paling kesulitan?", "hint": "Tidak apa-apa kalau ada yang susah — justru itu yang membuat kita belajar!", "placeholder": "Bagi aku yang paling sulit adalah..."},
    {"id": "q3", "question": "Apa yang sudah kamu berhasil buat atau selesaikan di block ini?", "hint": "Bisa berupa project, game, atau fitur baru yang berhasil kamu buat.", "placeholder": "Di block ini aku udah selesai bikin..."},
    {"id": "q4", "question": "Apa yang ingin kamu coba pelajari lebih lanjut?", "hint": "Ada hal yang bikin kamu penasaran ga?", "placeholder": "Aku penasaran pengen tau cara..."},
    {"id": "q5", "question": "Pesan untuk dirimu sendiri di block berikutnya:", "hint": "Tulis target atau penyemangat biar block depan makin jago!", "placeholder": "Semoga di block depan aku bisa..."}
  ]'::JSONB
);
*/
