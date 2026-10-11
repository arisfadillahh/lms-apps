ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS exit_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.enrollments
  DROP CONSTRAINT IF EXISTS enrollments_exit_reason_check;

ALTER TABLE public.enrollments
  ADD CONSTRAINT enrollments_exit_reason_check
  CHECK (exit_reason IS NULL OR exit_reason IN ('TRANSFERRED', 'INACTIVE', 'COMPLETED'));

UPDATE public.enrollments
SET ended_at = coalesce(ended_at, now()),
    exit_reason = coalesce(exit_reason, 'INACTIVE'),
    updated_at = now()
WHERE status = 'INACTIVE';

DROP TRIGGER IF EXISTS enrollments_set_updated_at ON public.enrollments;
CREATE TRIGGER enrollments_set_updated_at
BEFORE UPDATE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.classes
  DROP CONSTRAINT IF EXISTS classes_lifecycle_status_check;

ALTER TABLE public.classes
  ADD CONSTRAINT classes_lifecycle_status_check
  CHECK (lifecycle_status IN ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED'));

ALTER TABLE public.block_reports
  ADD COLUMN IF NOT EXISTS coach_id_snapshot uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coach_name_snapshot text;

CREATE TABLE IF NOT EXISTS public.enrollment_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coder_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  from_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  to_class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  source_enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  target_enrollment_id uuid REFERENCES public.enrollments(id) ON DELETE SET NULL,
  effective_at timestamptz NOT NULL,
  reason text NOT NULL,
  transferred_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_class_id <> to_class_id)
);

CREATE INDEX IF NOT EXISTS enrollment_transfers_coder_effective_idx
  ON public.enrollment_transfers (coder_id, effective_at DESC);

CREATE INDEX IF NOT EXISTS enrollment_transfers_class_effective_idx
  ON public.enrollment_transfers (from_class_id, to_class_id, effective_at DESC);

ALTER TABLE public.enrollment_transfers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_lifecycle_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  previous_status text NOT NULL,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  cancelled_session_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_lifecycle_changes_class_created_idx
  ON public.class_lifecycle_changes (class_id, created_at DESC);

ALTER TABLE public.class_lifecycle_changes ENABLE ROW LEVEL SECURITY;

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

  SELECT type INTO v_from_type FROM public.classes WHERE id = p_from_class_id;
  SELECT type INTO v_to_type FROM public.classes WHERE id = p_to_class_id AND lifecycle_status = 'ACTIVE';
  IF v_to_type IS NULL THEN
    RAISE EXCEPTION 'Kelas tujuan tidak ditemukan atau tidak aktif.';
  END IF;
  IF v_from_type IS DISTINCT FROM v_to_type THEN
    RAISE EXCEPTION 'Perpindahan hanya dapat dilakukan antar kelas dalam program yang sama.';
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

REVOKE ALL ON FUNCTION public.transfer_coder_enrollment(uuid, uuid, uuid, timestamptz, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_coder_enrollment(uuid, uuid, uuid, timestamptz, text, uuid) TO service_role;

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
    WHERE class_id = p_class_id AND status = 'ACTIVE';
  END IF;

  INSERT INTO public.class_lifecycle_changes (
    class_id, previous_status, new_status, changed_by, cancelled_session_count
  ) VALUES (
    p_class_id, v_previous_status, p_status, p_admin_id, v_cancelled
  );

  RETURN v_cancelled;
END;
$$;

REVOKE ALL ON FUNCTION public.set_class_lifecycle_status(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_class_lifecycle_status(uuid, text, uuid) TO service_role;

COMMENT ON TABLE public.enrollment_transfers IS
  'Immutable history of Admin initiated coder moves between classes.';
COMMENT ON COLUMN public.classes.lifecycle_status IS
  'Controls whether future sessions may produce reminders and operational activity.';
