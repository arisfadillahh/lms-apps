-- Manual midterm report cycles for Ekskul. Existing block and final reports remain unchanged.
CREATE TABLE IF NOT EXISTS public.ekskul_report_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'MIDTERM' CHECK (report_type = 'MIDTERM'),
  cutoff_at timestamp with time zone NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(class_id, report_type)
);

CREATE INDEX IF NOT EXISTS ekskul_report_cycles_class_created_idx
  ON public.ekskul_report_cycles(class_id, created_at DESC);

-- A cycle report is class-wide, so it intentionally has no curriculum block.
ALTER TABLE public.block_reports
  ALTER COLUMN block_id DROP NOT NULL;

ALTER TABLE public.block_reports
  ADD COLUMN IF NOT EXISTS report_period_type text NOT NULL DEFAULT 'BLOCK'
    CHECK (report_period_type IN ('BLOCK', 'EKSKUL_MIDTERM')),
  ADD COLUMN IF NOT EXISTS report_cycle_id uuid
    REFERENCES public.ekskul_report_cycles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS block_reports_ekskul_cycle_coder_unique
  ON public.block_reports(report_cycle_id, coder_id)
  WHERE report_cycle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS block_reports_report_cycle_idx
  ON public.block_reports(report_cycle_id)
  WHERE report_cycle_id IS NOT NULL;
