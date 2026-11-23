BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.holiday_class_registrations ADD COLUMN attribution jsonb;
ALTER TABLE public.holiday_class_whatsapp_outbox ADD COLUMN last_error text;
ALTER TABLE public.holiday_class_whatsapp_outbox DROP CONSTRAINT holiday_class_whatsapp_outbox_kind_check;
ALTER TABLE public.holiday_class_whatsapp_outbox ADD CONSTRAINT holiday_class_whatsapp_outbox_kind_check
  CHECK (kind IN ('registration_group','invoice_parent','paid_group','paid_parent','reminder_1','reminder_3'));

-- Serialize the same child/contact across request UUIDs. Different selections
-- remain separate purchases. Existing invoices are never changed or removed.
CREATE OR REPLACE FUNCTION public.create_holiday_class_registration(p_id uuid, p_hash text, p_details jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invoice_id uuid; v_hash text; v_number text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    (p_details->>'phone') || ':' || lower(trim(p_details->>'studentName')), 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 0));
  SELECT invoice_id, request_hash INTO v_invoice_id,v_hash FROM public.holiday_class_registrations WHERE id=p_id;
  IF FOUND THEN
    IF v_hash<>p_hash THEN RAISE EXCEPTION 'HOLIDAY_REQUEST_CHANGED' USING errcode='P0001'; END IF;
    RETURN v_invoice_id;
  END IF;
  SELECT r.invoice_id INTO v_invoice_id FROM public.holiday_class_registrations r
    JOIN public.invoices i ON i.id=r.invoice_id
    WHERE r.created_at >= now()-interval '24 hours'
      AND i.parent_phone=p_details->>'phone'
      AND lower(trim(i.seasonal_student_name))=lower(trim(p_details->>'studentName'))
      AND r.selections=p_details->'selections' AND r.platform=p_details->>'platform'
      AND r.school_grade=(p_details->>'schoolGrade')::smallint
      AND i.status::text IN ('PENDING','OVERDUE','PAID')
    ORDER BY r.created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_invoice_id; END IF;
  v_number := 'HC-2627-' || pg_catalog.to_char(pg_catalog.nextval('public.holiday_class_invoice_sequence'),'FM000000');
  INSERT INTO public.invoices(invoice_number,parent_name,parent_phone,seasonal_student_name,seasonal_student_phone,
    period_month,period_year,period_start_date,period_end_date,total_amount,due_date,status,invoice_type)
    VALUES(v_number,p_details->>'parentName',p_details->>'phone',p_details->>'studentName',p_details->>'phone',
      extract(month FROM (p_details->>'startDate')::date),extract(year FROM (p_details->>'startDate')::date),
      (p_details->>'startDate')::date,(p_details->>'endDate')::date,(p_details->>'total')::integer,
      least((now() AT TIME ZONE 'Asia/Jakarta')::date + greatest(1,least(30,coalesce((p_details->>'dueDays')::int,1))),
        (p_details->>'startDate')::date),'PENDING','SEASONAL') RETURNING id INTO v_invoice_id;
  INSERT INTO public.invoice_items(invoice_id,coder_name,class_name,level_name,description,base_price,discount_amount,final_price)
    SELECT v_invoice_id,p_details->>'studentName',item->>'name',p_details->>'level',item->>'description',
      (item->>'basePrice')::int,(item->>'discount')::int,(item->>'total')::int
      FROM pg_catalog.jsonb_array_elements(p_details->'items') item;
  INSERT INTO public.holiday_class_registrations(id,invoice_id,request_hash,email,school_grade,selections,platform,attribution)
    VALUES(p_id,v_invoice_id,p_hash,p_details->>'email',(p_details->>'schoolGrade')::smallint,
      p_details->'selections',p_details->>'platform',p_details->'attribution');
  INSERT INTO public.holiday_class_whatsapp_outbox(registration_id,kind) VALUES(p_id,'registration_group'),(p_id,'invoice_parent');
  RETURN v_invoice_id;
END; $$;

CREATE FUNCTION public.enqueue_holiday_reminders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF extract(hour FROM now() AT TIME ZONE 'Asia/Jakarta') NOT BETWEEN 9 AND 19 THEN RETURN 0; END IF;
  INSERT INTO public.holiday_class_whatsapp_outbox(registration_id,kind)
    SELECT r.id,CASE WHEN r.created_at <= now()-interval '3 days' THEN 'reminder_3' ELSE 'reminder_1' END
    FROM public.holiday_class_registrations r JOIN public.invoices i ON i.id=r.invoice_id
    WHERE i.status::text IN ('PENDING','OVERDUE') AND i.paid_at IS NULL
      AND r.created_at <= now()-interval '1 day'
      AND i.due_date >= (now() AT TIME ZONE 'Asia/Jakarta')::date
    ON CONFLICT(registration_id,kind) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_holiday_reminders() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_holiday_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_holiday_class_whatsapp(p_registration uuid DEFAULT NULL)
RETURNS SETOF public.holiday_class_whatsapp_outbox
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH due AS (
    SELECT n.id FROM public.holiday_class_whatsapp_outbox n
    WHERE (p_registration IS NULL OR n.registration_id=p_registration)
      AND n.sent_at IS NULL AND n.failed_at IS NULL AND n.next_attempt_at<=now()
      AND (n.claimed_at IS NULL OR n.claimed_at<now()-interval '10 minutes')
      AND (n.kind IN ('registration_group','invoice_parent','reminder_1','reminder_3') OR EXISTS (
        SELECT 1 FROM public.holiday_class_whatsapp_outbox previous WHERE previous.registration_id=n.registration_id
          AND previous.kind=CASE n.kind WHEN 'paid_group' THEN 'registration_group' ELSE 'invoice_parent' END
          AND (previous.sent_at IS NOT NULL OR previous.failed_at IS NOT NULL)))
    ORDER BY n.id LIMIT 12 FOR UPDATE SKIP LOCKED
  ) UPDATE public.holiday_class_whatsapp_outbox n SET claimed_at=now(),attempts=n.attempts+1
    FROM due WHERE n.id=due.id RETURNING n.*;
$$;
COMMIT;
