-- Transfer carries personal progress by immutable coder/level/block IDs. It never
-- writes coder_block_progress or calls finalize_coder_level. The source and
-- target Weekly classes must belong to the same level.
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.transfer_coder_enrollment(
  p_coder_id uuid,
  p_from_class_id uuid,
  p_to_class_id uuid,
  p_effective_at timestamptz,
  p_reason text,
  p_admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.enrollments%ROWTYPE;
  v_target public.enrollments%ROWTYPE;
  v_from_type text;
  v_to_type text;
  v_from_level uuid;
  v_to_level uuid;
  v_transfer_id uuid;
BEGIN
  IF p_from_class_id = p_to_class_id THEN
    RAISE EXCEPTION 'Kelas tujuan harus berbeda dari kelas asal.';
  END IF;
  IF p_effective_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Perpindahan terjadwal belum didukung. Pilih waktu efektif sekarang atau sebelumnya.';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Alasan perpindahan wajib diisi.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_id AND role = 'ADMIN' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Admin tidak valid.';
  END IF;

  SELECT * INTO v_source
  FROM public.enrollments
  WHERE class_id = p_from_class_id
    AND coder_id = p_coder_id
    AND status = 'ACTIVE'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment aktif di kelas asal tidak ditemukan.';
  END IF;
  IF p_effective_at < v_source.enrolled_at THEN
    RAISE EXCEPTION 'Tanggal pindah tidak boleh sebelum enrollment asal.';
  END IF;

  SELECT type, level_id INTO v_from_type, v_from_level FROM public.classes
    WHERE id = p_from_class_id AND lifecycle_status = 'ACTIVE';
  SELECT type, level_id INTO v_to_type, v_to_level FROM public.classes
    WHERE id = p_to_class_id AND lifecycle_status = 'ACTIVE'
      AND archived_at IS NULL AND end_date >= current_date;
  IF v_to_type IS NULL THEN
    RAISE EXCEPTION 'Kelas tujuan tidak ditemukan atau tidak aktif.';
  END IF;
  IF v_from_type IS DISTINCT FROM v_to_type THEN
    RAISE EXCEPTION 'Perpindahan hanya dapat dilakukan antar kelas dalam program yang sama.';
  END IF;
  IF v_from_type = 'WEEKLY' AND (v_from_level IS NULL OR v_from_level IS DISTINCT FROM v_to_level) THEN
    RAISE EXCEPTION 'Pindah kelas Weekly harus pada level yang sama; gunakan alur kenaikan level.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.enrollments e JOIN public.classes c ON c.id = e.class_id
    WHERE e.coder_id = p_coder_id AND e.status = 'ACTIVE'
      AND e.class_id NOT IN (p_from_class_id, p_to_class_id)
      AND c.type = v_from_type AND c.level_id IS NOT DISTINCT FROM v_from_level) THEN
    RAISE EXCEPTION 'Coder memiliki kelas aktif lain pada level yang sama.';
  END IF;

  UPDATE public.enrollments
  SET status = 'INACTIVE',
      ended_at = p_effective_at,
      exit_reason = 'TRANSFERRED',
      updated_at = now()
  WHERE id = v_source.id;

  INSERT INTO public.enrollments (class_id, coder_id, enrolled_at, status, ended_at, exit_reason, updated_at)
  VALUES (p_to_class_id, p_coder_id, p_effective_at, 'ACTIVE', NULL, NULL, now())
  ON CONFLICT (class_id, coder_id) DO UPDATE
  SET enrolled_at = EXCLUDED.enrolled_at,
      status = 'ACTIVE',
      ended_at = NULL,
      exit_reason = NULL,
      updated_at = now()
  RETURNING * INTO v_target;

  IF v_to_type = 'WEEKLY' THEN
    UPDATE public.coder_payment_periods
    SET class_id = p_to_class_id
    WHERE coder_id = p_coder_id AND status = 'ACTIVE';
  END IF;

  INSERT INTO public.enrollment_transfers (
    coder_id, from_class_id, to_class_id, source_enrollment_id,
    target_enrollment_id, effective_at, reason, transferred_by
  ) VALUES (
    p_coder_id, p_from_class_id, p_to_class_id, v_source.id,
    v_target.id, p_effective_at, trim(p_reason), p_admin_id
  ) RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'source_enrollment_id', v_source.id,
    'target_enrollment_id', v_target.id
  );
END;
$$;


-- A false completion may be cancelled without deleting its audit record.
-- Existing active rows remain unique; future genuine completion can insert
-- one new progression for the same coder/level.
CREATE UNIQUE INDEX IF NOT EXISTS coder_level_progressions_one_live_per_level_idx
  ON public.coder_level_progressions (coder_id, source_level_id)
  WHERE status <> 'CANCELLED';
ALTER TABLE public.coder_level_progressions
  DROP CONSTRAINT IF EXISTS coder_level_progressions_once_per_level;
ALTER TABLE public.coder_level_progressions
  DROP CONSTRAINT IF EXISTS coder_level_progressions_status_check;
ALTER TABLE public.coder_level_progressions
  ADD CONSTRAINT coder_level_progressions_status_check
  CHECK (status IN ('WAITING_PLACEMENT', 'PLACED', 'PROGRAM_COMPLETED', 'CANCELLED'));
ALTER TABLE public.coder_level_progressions
  DROP CONSTRAINT IF EXISTS coder_level_progressions_target_state_check;
ALTER TABLE public.coder_level_progressions
  ADD CONSTRAINT coder_level_progressions_target_state_check CHECK (
    (status = 'WAITING_PLACEMENT' AND target_level_id IS NOT NULL AND target_class_id IS NULL AND target_enrollment_id IS NULL AND placed_at IS NULL)
    OR (status = 'PLACED' AND target_level_id IS NOT NULL AND target_class_id IS NOT NULL AND target_enrollment_id IS NOT NULL AND placed_at IS NOT NULL)
    OR (status = 'PROGRAM_COMPLETED' AND target_level_id IS NULL AND target_class_id IS NULL AND target_enrollment_id IS NULL AND placed_at IS NULL)
    OR (status = 'CANCELLED' AND target_class_id IS NULL AND target_enrollment_id IS NULL AND placed_at IS NULL)
  );
-- Existing Admin/Coder RLS policies from 20260912150000 apply to CANCELLED rows.
-- Keep original function grants: CREATE OR REPLACE retains function identity.
CREATE OR REPLACE FUNCTION public.finalize_coder_level(
  p_coder_id uuid,
  p_source_level_id uuid,
  p_source_class_id uuid
) RETURNS TABLE(progression_id uuid, progression_status text, target_level_id uuid, created_now boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment public.enrollments%ROWTYPE;
  v_progression public.coder_level_progressions%ROWTYPE;
  v_next_level_id uuid;
  v_required_count integer;
  v_completed_count integer;
  v_source_class public.classes%ROWTYPE;
BEGIN
  SELECT * INTO v_enrollment
  FROM public.enrollments
  WHERE coder_id = p_coder_id AND class_id = p_source_class_id AND status = 'ACTIVE'
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_progression
    FROM public.coder_level_progressions
    WHERE coder_id = p_coder_id AND source_level_id = p_source_level_id
      AND status <> 'CANCELLED';
    IF FOUND THEN
      RETURN QUERY SELECT v_progression.id, v_progression.status, v_progression.target_level_id, false;
    END IF;
    RETURN;
  END IF;

  SELECT * INTO v_source_class FROM public.classes WHERE id = p_source_class_id;
  IF NOT FOUND OR v_source_class.level_id IS DISTINCT FROM p_source_level_id
     OR v_source_class.type <> 'WEEKLY' THEN
    RAISE EXCEPTION 'Source class does not belong to the requested Weekly level';
  END IF;

  -- A class can reuse the same curriculum block in later cycles. Never advance
  -- the level while its current cycle still runs.
  IF v_source_class.lifecycle_status <> 'ENDED' AND (
    v_source_class.end_date > current_date OR EXISTS (
      SELECT 1 FROM public.class_blocks cb
      WHERE cb.class_id = p_source_class_id AND cb.status IN ('CURRENT', 'UPCOMING')
    )
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_required_count
  FROM public.blocks block WHERE block.level_id = p_source_level_id;

  SELECT count(DISTINCT progress.block_id) INTO v_completed_count
  FROM public.coder_block_progress progress
  JOIN public.blocks block ON block.id = progress.block_id
  WHERE progress.coder_id = p_coder_id
    AND progress.level_id = p_source_level_id
    AND progress.status = 'COMPLETED'
    AND progress.completion_source IN ('MANUAL', 'ASSESSMENT')
    AND block.level_id = p_source_level_id;

  IF v_required_count = 0 OR v_completed_count <> v_required_count THEN
    RETURN;
  END IF;

  SELECT next_level.id INTO v_next_level_id
  FROM public.levels current_level
  JOIN public.levels next_level ON next_level.order_index > current_level.order_index
  WHERE current_level.id = p_source_level_id
  ORDER BY next_level.order_index, next_level.created_at, next_level.id
  LIMIT 1;

  INSERT INTO public.coder_level_progressions (
    coder_id, source_level_id, target_level_id, source_class_id, source_enrollment_id, status
  ) VALUES (
    p_coder_id,
    p_source_level_id,
    v_next_level_id,
    p_source_class_id,
    v_enrollment.id,
    CASE WHEN v_next_level_id IS NULL THEN 'PROGRAM_COMPLETED' ELSE 'WAITING_PLACEMENT' END
  )
  ON CONFLICT (coder_id, source_level_id) WHERE status <> 'CANCELLED' DO NOTHING
  RETURNING * INTO v_progression;

  IF NOT FOUND THEN
    SELECT * INTO v_progression
    FROM public.coder_level_progressions
    WHERE coder_id = p_coder_id AND source_level_id = p_source_level_id
      AND status <> 'CANCELLED';
    RETURN QUERY SELECT v_progression.id, v_progression.status, v_progression.target_level_id, false;
    RETURN;
  END IF;

  UPDATE public.enrollments
  SET status = 'INACTIVE', ended_at = v_progression.completed_at,
      exit_reason = 'COMPLETED', updated_at = now()
  WHERE coder_id = p_coder_id AND status = 'ACTIVE'
    AND class_id IN (SELECT id FROM public.classes WHERE level_id = p_source_level_id);

  RETURN QUERY SELECT v_progression.id, v_progression.status, v_progression.target_level_id, true;
END;
$$;
