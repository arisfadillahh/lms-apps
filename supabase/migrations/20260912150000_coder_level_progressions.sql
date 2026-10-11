CREATE TABLE IF NOT EXISTS public.coder_level_progressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coder_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE RESTRICT,
  target_level_id uuid REFERENCES public.levels(id) ON DELETE RESTRICT,
  source_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  source_enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  target_class_id uuid REFERENCES public.classes(id) ON DELETE RESTRICT,
  target_enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('WAITING_PLACEMENT', 'PLACED', 'PROGRAM_COMPLETED')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  placed_at timestamptz,
  placed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coder_level_progressions_once_per_level UNIQUE (coder_id, source_level_id),
  CONSTRAINT coder_level_progressions_target_state_check CHECK (
    (status = 'WAITING_PLACEMENT' AND target_level_id IS NOT NULL AND target_class_id IS NULL AND target_enrollment_id IS NULL AND placed_at IS NULL)
    OR (status = 'PLACED' AND target_level_id IS NOT NULL AND target_class_id IS NOT NULL AND target_enrollment_id IS NOT NULL AND placed_at IS NOT NULL)
    OR (status = 'PROGRAM_COMPLETED' AND target_level_id IS NULL AND target_class_id IS NULL AND target_enrollment_id IS NULL AND placed_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_coder_level_progressions_status_completed
  ON public.coder_level_progressions (status, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_coder_level_progressions_coder
  ON public.coder_level_progressions (coder_id, completed_at DESC);

DROP TRIGGER IF EXISTS coder_level_progressions_set_updated_at ON public.coder_level_progressions;
CREATE TRIGGER coder_level_progressions_set_updated_at
BEFORE UPDATE ON public.coder_level_progressions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.coder_level_progressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coder_level_progressions_admin_all ON public.coder_level_progressions;
CREATE POLICY coder_level_progressions_admin_all ON public.coder_level_progressions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'ADMIN' AND users.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'ADMIN' AND users.is_active = true
  ));

DROP POLICY IF EXISTS coder_level_progressions_coder_read ON public.coder_level_progressions;
CREATE POLICY coder_level_progressions_coder_read ON public.coder_level_progressions
  FOR SELECT TO authenticated USING (coder_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.coder_level_progressions TO authenticated, service_role;

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

  IF NOT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = p_source_class_id AND level_id = p_source_level_id AND type = 'WEEKLY'
  ) THEN
    RAISE EXCEPTION 'Source class does not belong to the requested Weekly level';
  END IF;

  SELECT count(DISTINCT progress.block_id) INTO v_required_count
  FROM public.coder_block_progress progress
  JOIN public.blocks block ON block.id = progress.block_id AND block.level_id = p_source_level_id
  WHERE progress.coder_id = p_coder_id AND progress.level_id = p_source_level_id;

  SELECT count(DISTINCT progress.block_id) INTO v_completed_count
  FROM public.coder_block_progress progress
  JOIN public.blocks block ON block.id = progress.block_id
  WHERE progress.coder_id = p_coder_id
    AND progress.level_id = p_source_level_id
    AND progress.status = 'COMPLETED'
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

REVOKE ALL ON FUNCTION public.finalize_coder_level(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_coder_level_progression(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_coder_level(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.place_coder_level_progression(uuid, uuid, uuid) TO service_role;
