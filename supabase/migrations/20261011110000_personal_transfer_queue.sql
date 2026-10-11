-- Personal queue alignment is part of the transfer transaction. Class history
-- supplies the destination position but never marks individual blocks complete.
ALTER TABLE public.coder_block_progress
  ADD COLUMN IF NOT EXISTS deferred_after_class boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entry_lesson_position integer;
ALTER TABLE public.coder_block_progress
  ADD CONSTRAINT coder_block_progress_entry_lesson_position_check
  CHECK (entry_lesson_position IS NULL OR entry_lesson_position >= 1);
CREATE INDEX IF NOT EXISTS coder_block_progress_deferred_idx
  ON public.coder_block_progress (coder_id, level_id, journey_order)
  WHERE deferred_after_class = true AND status <> 'COMPLETED';

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
  IF EXISTS (
    SELECT 1 FROM public.coder_block_progress progress
    WHERE progress.coder_id = p_coder_id AND progress.level_id = p_level_id
      AND progress.status <> 'COMPLETED'
      AND NOT EXISTS (SELECT 1 FROM public.class_blocks destination
        WHERE destination.class_id = p_target_class_id AND destination.block_id = progress.block_id)
  ) THEN
    RAISE EXCEPTION 'Kelas tujuan belum mempunyai materi untuk semua blok pribadi yang belum selesai.';
  END IF;

  -- Move all rows out of the unique journey_order range before reordering.
  UPDATE public.coder_block_progress SET journey_order = journey_order + 1000000
  WHERE coder_id = p_coder_id AND level_id = p_level_id;

  FOR v_row IN
    SELECT p.id, p.block_id, p.status, b.order_index
    FROM public.coder_block_progress p JOIN public.blocks b ON b.id = p.block_id
    WHERE p.coder_id = p_coder_id AND p.level_id = p_level_id
    ORDER BY CASE WHEN p.status = 'COMPLETED' THEN 0 ELSE 1 END,
      CASE WHEN p.status = 'COMPLETED' THEN p.journey_order END,
      CASE WHEN p.status <> 'COMPLETED' AND b.order_index >= v_target_order THEN 0 ELSE 1 END,
      b.order_index, p.id
  LOOP
    UPDATE public.coder_block_progress SET
      journey_order = v_new_order,
      status = CASE WHEN v_row.status = 'COMPLETED' THEN 'COMPLETED'
                    WHEN v_first_pending THEN 'IN_PROGRESS' ELSE 'PENDING' END,
      completed_at = CASE WHEN v_row.status = 'COMPLETED' THEN completed_at ELSE NULL END,
      completion_source = CASE WHEN v_row.status = 'COMPLETED' THEN completion_source ELSE NULL END,
      deferred_after_class = v_row.status <> 'COMPLETED' AND v_row.order_index < v_target_order,
      entry_lesson_position = CASE WHEN v_row.block_id = v_target_block_id
        THEN v_entry_lesson_position
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



-- Keep the enrollment available for a personal deferred block after class end.
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
      AND (p_status = 'CANCELLED' OR NOT EXISTS (
        SELECT 1 FROM public.coder_block_progress progress
        JOIN public.classes klass ON klass.id = p_class_id
        WHERE progress.coder_id = enrollments.coder_id
          AND progress.level_id = klass.level_id
          AND progress.deferred_after_class = true
          AND progress.status <> 'COMPLETED'
      ));
  END IF;

  INSERT INTO public.class_lifecycle_changes (
    class_id, previous_status, new_status, changed_by, cancelled_session_count
  ) VALUES (
    p_class_id, v_previous_status, p_status, p_admin_id, v_cancelled
  );

  RETURN v_cancelled;
END;
$$;
