-- Queue a deferred block for placement in a CURRENT class block. Never teach it
-- from the old class schedule. All writes below occur only when this migration is applied.
CREATE TABLE public.coder_block_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coder_id uuid NOT NULL REFERENCES public.users(id),
  level_id uuid NOT NULL REFERENCES public.levels(id),
  block_id uuid NOT NULL REFERENCES public.blocks(id),
  source_class_id uuid NOT NULL REFERENCES public.classes(id),
  source_enrollment_id uuid NOT NULL REFERENCES public.enrollments(id),
  entry_lesson_position integer NOT NULL DEFAULT 1 CHECK (entry_lesson_position >= 1),
  status text NOT NULL DEFAULT 'NEEDS_BLOCK_PLACEMENT'
    CHECK (status IN ('NEEDS_BLOCK_PLACEMENT', 'PLACED', 'CANCELLED')),
  target_class_id uuid REFERENCES public.classes(id),
  target_enrollment_id uuid REFERENCES public.enrollments(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT coder_block_placements_resolution_check CHECK (
    (status = 'NEEDS_BLOCK_PLACEMENT' AND target_class_id IS NULL AND target_enrollment_id IS NULL AND resolved_at IS NULL)
    OR (status = 'PLACED' AND target_class_id IS NOT NULL AND target_enrollment_id IS NOT NULL AND resolved_at IS NOT NULL)
    OR (status = 'CANCELLED' AND target_class_id IS NULL AND target_enrollment_id IS NULL)
  )
);
CREATE UNIQUE INDEX coder_block_placements_one_open_idx
  ON public.coder_block_placements(coder_id, level_id)
  WHERE status = 'NEEDS_BLOCK_PLACEMENT';
CREATE INDEX coder_block_placements_admin_queue_idx
  ON public.coder_block_placements(status, created_at);
ALTER TABLE public.coder_block_placements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coder_block_placements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.coder_block_placements TO service_role;

-- Reference key belongs to the in-app notification, with a database uniqueness guard.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS reference_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_recipient_reference_idx
  ON public.notifications(user_id, reference_key) WHERE reference_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_deferred_block_placement(
  p_coder_id uuid, p_level_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_needed public.coder_block_progress%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_placement_id uuid;
  v_coder_name text;
  v_block_name text;
BEGIN
  SELECT * INTO v_needed FROM public.coder_block_progress
  WHERE coder_id = p_coder_id AND level_id = p_level_id
    AND deferred_after_class = true AND status <> 'COMPLETED'
  ORDER BY journey_order LIMIT 1;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.coder_block_progress p
    WHERE p.coder_id = p_coder_id AND p.level_id = p_level_id
      AND p.deferred_after_class = false AND p.status <> 'COMPLETED'
  ) THEN RETURN NULL; END IF;

  SELECT e.* INTO v_enrollment FROM public.enrollments e
  JOIN public.classes c ON c.id = e.class_id
  WHERE e.coder_id = p_coder_id AND e.status = 'ACTIVE'
    AND c.level_id = p_level_id AND c.type = 'WEEKLY'
  ORDER BY e.enrolled_at DESC LIMIT 1 FOR UPDATE OF e;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.coder_block_placements
    (coder_id, level_id, block_id, source_class_id, source_enrollment_id, entry_lesson_position)
  VALUES (p_coder_id, p_level_id, v_needed.block_id, v_enrollment.class_id,
          v_enrollment.id, greatest(coalesce(v_needed.entry_lesson_position, 1), 1))
  ON CONFLICT (coder_id, level_id) WHERE status = 'NEEDS_BLOCK_PLACEMENT'
  DO NOTHING RETURNING id INTO v_placement_id;
  IF v_placement_id IS NOT NULL THEN
    SELECT full_name INTO v_coder_name FROM public.users WHERE id = p_coder_id;
    SELECT name INTO v_block_name FROM public.blocks WHERE id = v_needed.block_id;
    INSERT INTO public.notifications(user_id, title, message, type, is_read, reference_key)
    SELECT id, 'Coder perlu penempatan blok',
      coalesce(v_coder_name, 'Coder') || ' perlu kelas aktif untuk blok ' || coalesce(v_block_name, v_needed.block_id::text) ||
      ' (lanjut dari pertemuan ' || greatest(coalesce(v_needed.entry_lesson_position, 1), 1)::text || ').',
      'BLOCK_PLACEMENT', false, 'block-placement:' || v_placement_id::text
    FROM public.users WHERE role = 'ADMIN' AND is_active = true
    ON CONFLICT (user_id, reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN coalesce(v_placement_id, (SELECT id FROM public.coder_block_placements
    WHERE coder_id = p_coder_id AND level_id = p_level_id
      AND status = 'NEEDS_BLOCK_PLACEMENT'));
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_deferred_block_placement(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_deferred_block_placement(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.on_coder_block_completed_check_placement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_changed record;
BEGIN
  -- Statement trigger sees the whole admin override, regardless of row order.
  FOR v_changed IN SELECT DISTINCT coder_id, level_id FROM changed_rows
    WHERE status = 'COMPLETED' LOOP
    PERFORM public.ensure_deferred_block_placement(v_changed.coder_id, v_changed.level_id);
  END LOOP;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS coder_block_completed_check_placement ON public.coder_block_progress;
CREATE TRIGGER coder_block_completed_check_placement
  AFTER UPDATE ON public.coder_block_progress
  REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.on_coder_block_completed_check_placement();

CREATE OR REPLACE FUNCTION public.align_transferred_coder_journey(
  p_coder_id uuid, p_level_id uuid, p_source_class_id uuid,
  p_target_class_id uuid, p_effective_at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_block_id uuid;
  v_target_class_block_id uuid;
  v_target_order integer;
  v_entry_lesson_position integer;
  v_source_block_id uuid;
  v_source_class_block_id uuid;
  v_source_resume_position integer;
  v_next_order integer;
  v_new_order integer := 0;
  v_first_pending boolean := true;
  v_row record;
BEGIN
  SELECT cb.block_id, cb.id INTO v_target_block_id, v_target_class_block_id
  FROM public.class_blocks cb
  WHERE cb.class_id = p_target_class_id AND cb.status IN ('CURRENT', 'UPCOMING')
  ORDER BY CASE WHEN cb.status = 'CURRENT' THEN 0 ELSE 1 END,
    CASE WHEN cb.status = 'CURRENT' THEN cb.start_date END DESC,
    CASE WHEN cb.status = 'UPCOMING' THEN cb.start_date END ASC, cb.id
  LIMIT 1;
  IF v_target_block_id IS NULL THEN
    RAISE EXCEPTION 'Kelas tujuan belum memiliki blok aktif/berikutnya.';
  END IF;
  SELECT order_index INTO v_target_order FROM public.blocks
  WHERE id = v_target_block_id AND level_id = p_level_id;
  IF v_target_order IS NULL THEN
    RAISE EXCEPTION 'Blok kelas tujuan bukan bagian dari level coder.';
  END IF;
  -- ASUMSI 1/2: pindah di blok sama mengikuti posisi kelas tujuan; sesi yang terlewat hanya catch-up.
  SELECT count(DISTINCT cl.id) + 1 INTO v_entry_lesson_position
  FROM public.class_lessons cl
  JOIN public.sessions s ON s.id = cl.session_id
  WHERE cl.class_block_id = v_target_class_block_id AND s.status = 'COMPLETED';

  SELECT block_id INTO v_source_block_id FROM public.coder_block_progress
  WHERE coder_id = p_coder_id AND level_id = p_level_id AND status = 'IN_PROGRESS'
  ORDER BY journey_order LIMIT 1;
  SELECT id INTO v_source_class_block_id FROM public.class_blocks
  WHERE class_id = p_source_class_id AND block_id = v_source_block_id
  ORDER BY CASE WHEN status = 'CURRENT' THEN 0 ELSE 1 END, start_date DESC LIMIT 1;
  -- ASUMSI 5: posisi asal dihitung dari jumlah pelajaran dengan attendance PRESENT.
  SELECT count(DISTINCT cl.id) + 1 INTO v_source_resume_position
  FROM public.class_lessons cl
  JOIN public.sessions s ON s.id = cl.session_id
  JOIN public.attendance a ON a.session_id = s.id
    AND a.coder_id = p_coder_id AND a.status = 'PRESENT'
  WHERE cl.class_block_id = v_source_class_block_id
    AND s.status = 'COMPLETED' AND s.date_time <= p_effective_at;

  PERFORM 1 FROM public.coder_block_progress
  WHERE coder_id = p_coder_id AND level_id = p_level_id FOR UPDATE;
  SELECT coalesce(max(journey_order), -1) + 1 INTO v_next_order
  FROM public.coder_block_progress WHERE coder_id = p_coder_id AND level_id = p_level_id;
  IF v_next_order >= 1000000 THEN RAISE EXCEPTION 'Journey order is outside supported range'; END IF;

  FOR v_row IN SELECT id FROM public.blocks WHERE level_id = p_level_id ORDER BY order_index, id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE coder_id = p_coder_id AND block_id = v_row.id) THEN
      INSERT INTO public.coder_block_progress
        (coder_id, level_id, block_id, journey_order, status)
      VALUES (p_coder_id, p_level_id, v_row.id, v_next_order, 'PENDING');
      v_next_order := v_next_order + 1;
    END IF;
  END LOOP;
  IF v_next_order >= 1000000 THEN RAISE EXCEPTION 'Journey order is outside supported range'; END IF;

  -- Move all rows out of the unique journey_order range before reordering.
  UPDATE public.coder_block_progress SET journey_order = journey_order + 1000000
  WHERE coder_id = p_coder_id AND level_id = p_level_id;

  FOR v_row IN
    SELECT p.id, p.block_id, p.status, b.order_index
    FROM public.coder_block_progress p JOIN public.blocks b ON b.id = p.block_id
    WHERE p.coder_id = p_coder_id AND p.level_id = p_level_id
    ORDER BY CASE WHEN p.status = 'COMPLETED' THEN 0 ELSE 1 END,
      CASE WHEN p.status = 'COMPLETED' THEN p.journey_order END,
      CASE WHEN p.status = 'COMPLETED' THEN 0
           WHEN p.block_id = v_source_block_id AND p.block_id <> v_target_block_id THEN 2
           WHEN b.order_index >= v_target_order THEN 0 ELSE 1 END,
      b.order_index, p.id
  LOOP
    UPDATE public.coder_block_progress SET
      journey_order = v_new_order,
      status = CASE WHEN v_row.status = 'COMPLETED' THEN 'COMPLETED'
                    WHEN v_first_pending THEN 'IN_PROGRESS' ELSE 'PENDING' END,
      completed_at = CASE WHEN v_row.status = 'COMPLETED' THEN completed_at ELSE NULL END,
      completion_source = CASE WHEN v_row.status = 'COMPLETED' THEN completion_source ELSE NULL END,
      deferred_after_class = v_row.status <> 'COMPLETED' AND
        (v_row.order_index < v_target_order OR
         (v_row.block_id = v_source_block_id AND v_row.block_id <> v_target_block_id)),
      entry_lesson_position = CASE WHEN v_row.block_id = v_target_block_id
        THEN CASE WHEN v_source_block_id = v_target_block_id THEN v_entry_lesson_position
          ELSE greatest(v_entry_lesson_position, coalesce(entry_lesson_position, 1)) END
        WHEN v_row.block_id = v_source_block_id AND v_row.status <> 'COMPLETED'
        THEN greatest(coalesce(entry_lesson_position, 1), v_source_resume_position)
        ELSE entry_lesson_position END
    WHERE id = v_row.id;
    IF v_row.status <> 'COMPLETED' THEN v_first_pending := false; END IF;
    v_new_order := v_new_order + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.align_transferred_coder_journey(uuid, uuid, uuid, uuid, timestamptz) FROM PUBLIC;

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
  v_placement public.coder_block_placements%ROWTYPE;
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
    WHERE id = p_from_class_id AND lifecycle_status <> 'CANCELLED';
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

  SELECT * INTO v_placement FROM public.coder_block_placements
  WHERE coder_id = p_coder_id AND level_id = v_from_level
    AND status = 'NEEDS_BLOCK_PLACEMENT' FOR UPDATE;
  IF FOUND AND NOT EXISTS (
    SELECT 1 FROM public.class_blocks cb
    WHERE cb.class_id = p_to_class_id AND cb.block_id = v_placement.block_id
      AND cb.status = 'CURRENT'
  ) THEN
    RAISE EXCEPTION 'Penempatan harus ke kelas yang sedang menjalankan blok tertunda.';
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
    PERFORM public.align_transferred_coder_journey(
      p_coder_id, v_to_level, p_from_class_id, p_to_class_id, p_effective_at);
    UPDATE public.coder_payment_periods
    SET class_id = p_to_class_id
    WHERE coder_id = p_coder_id AND status = 'ACTIVE';
  END IF;

  IF v_placement.id IS NOT NULL THEN
    UPDATE public.coder_block_placements
    SET status = 'PLACED', target_class_id = p_to_class_id,
        target_enrollment_id = v_target.id, resolved_at = now()
    WHERE id = v_placement.id;
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



CREATE OR REPLACE FUNCTION public.set_class_lifecycle_status(
  p_class_id uuid,
  p_status text,
  p_admin_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled integer := 0;
  v_previous_status text;
BEGIN
  IF p_status NOT IN ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Status operasional kelas tidak valid.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_admin_id AND role = 'ADMIN' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Admin tidak valid.';
  END IF;

  SELECT lifecycle_status INTO v_previous_status
  FROM public.classes
  WHERE id = p_class_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kelas tidak ditemukan.'; END IF;

  IF v_previous_status IN ('ENDED', 'CANCELLED') AND p_status = 'ACTIVE' THEN
    RAISE EXCEPTION 'Kelas yang sudah selesai atau ditiadakan tidak dapat diaktifkan kembali secara langsung.';
  END IF;

  UPDATE public.classes
  SET lifecycle_status = p_status, updated_at = now()
  WHERE id = p_class_id;

  IF p_status IN ('ENDED', 'CANCELLED') THEN
    UPDATE public.sessions
    SET status = 'CANCELLED', updated_at = now()
    WHERE class_id = p_class_id
      AND status = 'SCHEDULED'
      AND date_time >= now();
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    UPDATE public.enrollments
    SET status = 'INACTIVE',
        ended_at = now(),
        exit_reason = CASE WHEN p_status = 'ENDED' THEN 'COMPLETED' ELSE 'INACTIVE' END,
        updated_at = now()
    WHERE class_id = p_class_id AND status = 'ACTIVE'
      AND NOT EXISTS (
        SELECT 1 FROM public.coder_block_placements placement
        WHERE placement.coder_id = enrollments.coder_id
          AND placement.source_class_id = p_class_id
          AND placement.status = 'NEEDS_BLOCK_PLACEMENT'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.coder_block_progress progress
        JOIN public.classes klass ON klass.id = p_class_id
        WHERE progress.coder_id = enrollments.coder_id
          AND progress.level_id = klass.level_id
          AND progress.deferred_after_class = true
          AND progress.status <> 'COMPLETED'
      );
  END IF;

  INSERT INTO public.class_lifecycle_changes (
    class_id, previous_status, new_status, changed_by, cancelled_session_count
  ) VALUES (
    p_class_id, v_previous_status, p_status, p_admin_id, v_cancelled
  );

  RETURN v_cancelled;
END;
$$;

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

  -- Placement is a separate state; it never completes a level or deactivates enrollment.
  IF EXISTS (SELECT 1 FROM public.coder_block_placements placement
    WHERE placement.coder_id = p_coder_id AND placement.level_id = p_source_level_id
      AND placement.status = 'NEEDS_BLOCK_PLACEMENT') OR EXISTS (
    SELECT 1 FROM public.coder_block_progress progress
    WHERE progress.coder_id = p_coder_id AND progress.level_id = p_source_level_id
      AND progress.deferred_after_class = true AND progress.status <> 'COMPLETED'
  ) THEN RETURN; END IF;

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

-- Existing-row review at migration time: only unfinished deferred journeys with
-- all class-sequence blocks complete may enter the placement queue.
DO $$
DECLARE v_existing record;
BEGIN
  FOR v_existing IN
    SELECT DISTINCT coder_id, level_id FROM public.coder_block_progress
    WHERE deferred_after_class = true AND status <> 'COMPLETED'
  LOOP
    PERFORM public.ensure_deferred_block_placement(v_existing.coder_id, v_existing.level_id);
  END LOOP;
END;
$$;
