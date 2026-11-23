BEGIN;
SET LOCAL lock_timeout='5s';
-- Change function defaults for future registrations only. Never update invoice rows.
DO $$
DECLARE definition text;
BEGIN
  definition:=pg_get_functiondef('public.create_holiday_class_registration(uuid,text,jsonb)'::regprocedure);
  IF position('coalesce((p_details->>''dueDays'')::int,1)' IN definition)=0 THEN
    RAISE EXCEPTION 'Unexpected Holiday registration function; review before migration';
  END IF;
  EXECUTE replace(definition,'coalesce((p_details->>''dueDays'')::int,1)','coalesce((p_details->>''dueDays'')::int,3)');
END; $$;

CREATE OR REPLACE FUNCTION public.enqueue_holiday_reminders(p_now timestamptz DEFAULT now()) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
  IF extract(hour FROM p_now AT TIME ZONE 'Asia/Jakarta') NOT BETWEEN 9 AND 19 THEN RETURN 0; END IF;
  INSERT INTO public.holiday_class_whatsapp_outbox(registration_id,kind)
    SELECT r.id,CASE WHEN (p_now AT TIME ZONE 'Asia/Jakarta')::date-(r.created_at AT TIME ZONE 'Asia/Jakarta')::date>=3
      THEN 'reminder_3' ELSE 'reminder_1' END
    FROM public.holiday_class_registrations r JOIN public.invoices i ON i.id=r.invoice_id
    WHERE i.status::text IN ('PENDING','OVERDUE') AND i.paid_at IS NULL
      AND (p_now AT TIME ZONE 'Asia/Jakarta')::date>(r.created_at AT TIME ZONE 'Asia/Jakarta')::date
      AND i.due_date>=(p_now AT TIME ZONE 'Asia/Jakarta')::date
    ON CONFLICT(registration_id,kind) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_holiday_reminders(timestamptz) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_holiday_reminders(timestamptz) TO service_role;
COMMIT;
