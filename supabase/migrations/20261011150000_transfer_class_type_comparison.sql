-- Compare the class type enum with the text variable in transfer validation.
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
      AND c.type::text = v_from_type AND c.level_id IS NOT DISTINCT FROM v_from_level) THEN
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
