BEGIN;

CREATE FUNCTION public.close_and_archive_class(
  p_class_id uuid, p_actor_id uuid, p_confirmation_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_class public.classes%ROWTYPE;
  v_now timestamptz := now();
  v_sessions integer;
  v_enrollments integer;
  v_periods integer;
  v_invoices integer;
  v_pending_placements integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_actor_id AND role = 'ADMIN' AND is_active) THEN
    RAISE EXCEPTION 'Admin tidak valid.' USING ERRCODE = 'PT403';
  END IF;

  IF p_confirmation_name IS NULL THEN
    SELECT * INTO v_class FROM public.classes WHERE id = p_class_id;
  ELSE
    SELECT * INTO v_class FROM public.classes WHERE id = p_class_id FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kelas tidak ditemukan.' USING ERRCODE = 'PT404'; END IF;
  IF p_confirmation_name IS NOT NULL AND p_confirmation_name <> btrim(v_class.name) THEN
    RAISE EXCEPTION 'Nama kelas berubah. Buka konfirmasi lagi.' USING ERRCODE = 'PT409';
  END IF;

  SELECT count(DISTINCT i.id) INTO v_invoices
    FROM public.invoices i JOIN public.invoice_items it ON it.invoice_id = i.id
    JOIN public.coder_payment_periods p ON p.id = it.payment_period_id
    WHERE p.class_id = p_class_id AND i.status IN ('PENDING', 'OVERDUE');

  IF v_class.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('archived', true, 'className', v_class.name, 'sessions', 0,
      'enrollments', 0, 'paymentPeriods', 0, 'openInvoices', v_invoices, 'pendingPlacements', 0);
  END IF;

  -- Deferred placement still uses the active source enrollment to transfer the learner.
  SELECT count(*) INTO v_pending_placements FROM public.enrollments e
    WHERE e.class_id = p_class_id AND e.status = 'ACTIVE' AND (
      EXISTS (SELECT 1 FROM public.coder_block_placements p WHERE p.coder_id = e.coder_id
        AND p.source_class_id = e.class_id AND p.status = 'NEEDS_BLOCK_PLACEMENT') OR
      EXISTS (SELECT 1 FROM public.coder_block_progress p WHERE p.coder_id = e.coder_id
        AND p.level_id = v_class.level_id AND p.deferred_after_class AND p.status <> 'COMPLETED')
    );

  IF p_confirmation_name IS NULL THEN
    SELECT count(*) INTO v_sessions FROM public.sessions
      WHERE class_id = p_class_id AND status = 'SCHEDULED' AND date_time >= v_now;
    SELECT count(*) INTO v_enrollments FROM public.enrollments WHERE class_id = p_class_id AND status = 'ACTIVE';
    SELECT count(*) INTO v_periods FROM public.coder_payment_periods WHERE class_id = p_class_id AND status = 'ACTIVE';
  ELSE
    IF v_pending_placements > 0 THEN
      RAISE EXCEPTION 'Pindahkan siswa yang menunggu penempatan blok sebelum menutup kelas.' USING ERRCODE = 'PT409';
    END IF;
    UPDATE public.classes SET archived_at = v_now,
      lifecycle_status = CASE WHEN v_class.lifecycle_status = 'CANCELLED' THEN 'CANCELLED' ELSE 'ENDED' END,
      updated_at = v_now WHERE id = p_class_id;
    UPDATE public.sessions SET status = 'CANCELLED', updated_at = v_now
      WHERE class_id = p_class_id AND status = 'SCHEDULED' AND date_time >= v_now;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;
    UPDATE public.enrollments SET status = 'INACTIVE',
      ended_at = greatest(enrolled_at, v_now), exit_reason = 'COMPLETED', updated_at = v_now
      WHERE class_id = p_class_id AND status = 'ACTIVE';
    GET DIAGNOSTICS v_enrollments = ROW_COUNT;
    UPDATE public.coder_payment_periods SET status = 'EXPIRED' WHERE class_id = p_class_id AND status = 'ACTIVE';
    GET DIAGNOSTICS v_periods = ROW_COUNT;
    INSERT INTO public.class_lifecycle_changes (class_id, previous_status, new_status, changed_by, cancelled_session_count)
      VALUES (p_class_id, v_class.lifecycle_status,
        CASE WHEN v_class.lifecycle_status = 'CANCELLED' THEN 'CANCELLED' ELSE 'ENDED' END, p_actor_id, v_sessions);
  END IF;

  RETURN jsonb_build_object('archived', p_confirmation_name IS NOT NULL, 'className', v_class.name,
    'sessions', v_sessions, 'enrollments', v_enrollments, 'paymentPeriods', v_periods,
    'openInvoices', v_invoices, 'pendingPlacements', v_pending_placements);
END;
$$;

CREATE FUNCTION public.keep_archived_class_payment_inactive() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_archived_at timestamptz;
BEGIN
  IF NEW.status = 'ACTIVE' AND NEW.class_id IS NOT NULL THEN
    -- Serialize a late settlement with class closure. Keep the financial record.
    SELECT archived_at INTO v_archived_at FROM public.classes WHERE id = NEW.class_id FOR SHARE;
    IF v_archived_at IS NOT NULL THEN NEW.status := 'EXPIRED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER keep_archived_class_payment_inactive
BEFORE INSERT OR UPDATE OF class_id, status ON public.coder_payment_periods
FOR EACH ROW EXECUTE FUNCTION public.keep_archived_class_payment_inactive();

CREATE FUNCTION public.guard_archived_class_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_archived_at timestamptz;
BEGIN
  IF (TG_TABLE_NAME = 'sessions' AND NEW.status = 'SCHEDULED')
    OR (TG_TABLE_NAME = 'enrollments' AND NEW.status = 'ACTIVE') THEN
    SELECT archived_at INTO v_archived_at FROM public.classes WHERE id = NEW.class_id FOR SHARE;
    IF v_archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Kelas sudah diarsipkan.' USING ERRCODE = 'PT409';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_archived_class_sessions BEFORE INSERT OR UPDATE OF class_id, status, date_time ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_class_schedule();
CREATE TRIGGER guard_archived_class_enrollments BEFORE INSERT OR UPDATE OF class_id, status ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_class_schedule();

REVOKE ALL ON FUNCTION public.close_and_archive_class(uuid, uuid, text), public.keep_archived_class_payment_inactive(),
  public.guard_archived_class_schedule()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_and_archive_class(uuid, uuid, text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
