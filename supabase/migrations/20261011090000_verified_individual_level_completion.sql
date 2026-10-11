-- Supersedes the production level finalizer after the progression schema migration.
-- Historic COMPLETED rows have no verified individual evidence and remain untrusted.
ALTER TABLE public.coder_block_progress
  ADD COLUMN IF NOT EXISTS completion_source text;
ALTER TABLE public.coder_block_progress
  DROP CONSTRAINT IF EXISTS coder_block_progress_completion_source_check;
ALTER TABLE public.coder_block_progress
  ADD CONSTRAINT coder_block_progress_completion_source_check
  CHECK (completion_source IS NULL OR completion_source IN ('MANUAL', 'ASSESSMENT'));

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
    WHERE coder_id = p_coder_id AND source_level_id = p_source_level_id;
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
  ON CONFLICT (coder_id, source_level_id) DO NOTHING
  RETURNING * INTO v_progression;

  IF NOT FOUND THEN
    SELECT * INTO v_progression
    FROM public.coder_level_progressions
    WHERE coder_id = p_coder_id AND source_level_id = p_source_level_id;
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
CREATE OR REPLACE FUNCTION public.place_coder_level_progression(
  p_progression_id uuid,
  p_target_class_id uuid,
  p_admin_id uuid
) RETURNS TABLE(target_enrollment_id uuid, placed_now boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progression public.coder_level_progressions%ROWTYPE;
  v_target_class public.classes%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = p_admin_id AND role = 'ADMIN' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only an active Admin can place a Coder';
  END IF;

  SELECT * INTO v_progression FROM public.coder_level_progressions
  WHERE id = p_progression_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Level progression not found'; END IF;

  IF v_progression.status = 'PLACED' THEN
    IF v_progression.target_class_id IS DISTINCT FROM p_target_class_id THEN
      RAISE EXCEPTION 'Coder was already placed in another class';
    END IF;
    RETURN QUERY SELECT v_progression.target_enrollment_id, false;
    RETURN;
  END IF;
  IF v_progression.status <> 'WAITING_PLACEMENT' THEN
    RAISE EXCEPTION 'This progression cannot be placed';
  END IF;

  -- A previously created queue item can become stale after the source
  -- enrollment is reactivated or its individual progress is corrected.
  IF NOT EXISTS (SELECT 1 FROM public.enrollments e
    WHERE e.id = v_progression.source_enrollment_id AND e.status = 'INACTIVE'
      AND e.exit_reason = 'COMPLETED') OR
     EXISTS (SELECT 1 FROM public.classes c WHERE c.id = v_progression.source_class_id
       AND c.lifecycle_status <> 'ENDED' AND c.end_date > current_date) OR
     (SELECT count(DISTINCT p.block_id) FROM public.coder_block_progress p
       WHERE p.coder_id = v_progression.coder_id AND p.level_id = v_progression.source_level_id
         AND p.status = 'COMPLETED' AND p.completion_source IN ('MANUAL', 'ASSESSMENT'))
       <> (SELECT count(*) FROM public.blocks b WHERE b.level_id = v_progression.source_level_id) THEN
    RAISE EXCEPTION 'Source level completion is no longer valid';
  END IF;

  SELECT * INTO v_target_class FROM public.classes WHERE id = p_target_class_id;
  IF NOT FOUND OR v_target_class.type <> 'WEEKLY'
    OR v_target_class.lifecycle_status <> 'ACTIVE'
    OR v_target_class.end_date < current_date
    OR v_target_class.level_id IS DISTINCT FROM v_progression.target_level_id THEN
    RAISE EXCEPTION 'Target class is not an active Weekly class for the target level';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.enrollments enrollment
    JOIN public.classes target_class_row ON target_class_row.id = enrollment.class_id
    WHERE enrollment.coder_id = v_progression.coder_id
      AND enrollment.status = 'ACTIVE'
      AND target_class_row.level_id = v_progression.target_level_id
      AND enrollment.class_id <> p_target_class_id
  ) THEN
    RAISE EXCEPTION 'Coder already has another active class at the target level';
  END IF;

  INSERT INTO public.enrollments (class_id, coder_id, status, enrolled_at, ended_at, exit_reason, updated_at)
  VALUES (p_target_class_id, v_progression.coder_id, 'ACTIVE', now(), NULL, NULL, now())
  ON CONFLICT (class_id, coder_id) DO UPDATE
  SET status = 'ACTIVE', enrolled_at = now(), ended_at = NULL, exit_reason = NULL, updated_at = now()
  RETURNING * INTO v_enrollment;

  UPDATE public.coder_payment_periods SET class_id = p_target_class_id
  WHERE coder_id = v_progression.coder_id AND status = 'ACTIVE';

  UPDATE public.coder_level_progressions
  SET target_class_id = p_target_class_id, target_enrollment_id = v_enrollment.id,
      placed_at = now(), placed_by = p_admin_id, status = 'PLACED'
  WHERE id = p_progression_id;

  RETURN QUERY SELECT v_enrollment.id, true;
END;
$$;
