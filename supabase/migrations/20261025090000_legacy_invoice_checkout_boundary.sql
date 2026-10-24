BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.validate_invoice_checkout_periods(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; v_start date; v_end date; v_duration integer; v_ranges jsonb:='[]';
BEGIN
  FOR r IN SELECT it.*,inv.period_start_date,inv.period_end_date,pp.class_id,pp.coder_id AS owner_id,
    pp.start_date AS anchor_start,pp.end_date AS anchor_end,pl.duration_months AS plan_duration
    FROM public.invoice_items it JOIN public.invoices inv ON inv.id=it.invoice_id
    LEFT JOIN public.coder_payment_periods pp ON pp.id=it.payment_period_id
    LEFT JOIN public.payment_plans pl ON pl.id=pp.payment_plan_id
    WHERE it.invoice_id=ANY(p_ids) ORDER BY it.id LOOP
    v_start:=coalesce(r.billing_start_date,r.period_start_date);
    v_duration:=coalesce(r.billing_duration_months,r.plan_duration);
    v_end:=coalesce(r.billing_end_date,(v_start+make_interval(months=>v_duration)-interval '1 day')::date);

    -- Legacy renewals labelled the next cycle with the previous period's last
    -- day. Only that exact, fully unsnapshotted shape may use its next day;
    -- explicit billing snapshots and ambiguous historical records stay strict.
    IF r.billing_start_date IS NULL AND r.billing_end_date IS NULL AND r.billing_duration_months IS NULL
      AND v_duration BETWEEN 1 AND 24 AND r.anchor_end>=r.anchor_start
      AND r.period_start_date=r.anchor_end
      AND r.period_end_date=(r.period_start_date+make_interval(months=>v_duration)-interval '1 day')::date THEN
      v_start:=r.anchor_end+1;
      v_end:=(v_start+make_interval(months=>v_duration)-interval '1 day')::date;
    END IF;

    IF r.coder_id IS NULL OR r.class_id IS NULL OR r.coder_id IS DISTINCT FROM r.owner_id OR v_start IS NULL OR v_end IS NULL
      OR v_duration IS NULL OR v_duration NOT BETWEEN 1 AND 24 OR v_start<=r.anchor_start
      OR v_end<>(v_start+make_interval(months=>v_duration)-interval '1 day')::date THEN RAISE EXCEPTION 'CHECKOUT_PERIOD_REVIEW_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM public.coder_payment_periods WHERE coder_id=r.coder_id AND class_id=r.class_id
      AND status IN ('ACTIVE','EXPIRED') AND start_date<=v_end AND end_date>=v_start)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_ranges) x WHERE x->>'coder'=r.coder_id::text AND x->>'class'=r.class_id::text
        AND (x->>'start')::date<=v_end AND (x->>'end')::date>=v_start) THEN RAISE EXCEPTION 'CHECKOUT_PERIOD_OVERLAP'; END IF;
    v_ranges:=v_ranges||jsonb_build_array(jsonb_build_object('coder',r.coder_id,'class',r.class_id,'start',v_start,'end',v_end));
    IF r.billing_start_date IS NULL OR r.billing_end_date IS NULL OR r.billing_duration_months IS NULL THEN
      UPDATE public.invoice_items SET billing_start_date=v_start,billing_end_date=v_end,billing_duration_months=v_duration WHERE id=r.id;
    END IF;
  END LOOP;
END $$;

COMMIT;
