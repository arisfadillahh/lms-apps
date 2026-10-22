-- Additive, opt-in payment workflow. No backfill, invoice deletion, or data rollback.
-- Deploy handlers with LMS_SELECTED_INVOICE_CHECKOUT_ENABLED=false first.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.invoice_settings ADD COLUMN IF NOT EXISTS selected_invoices_message_template text;
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS billing_start_date date,
  ADD COLUMN IF NOT EXISTS billing_end_date date,
  ADD COLUMN IF NOT EXISTS billing_duration_months integer;

-- Observe existing ACTIVE/INACTIVE controls; no separate leave/freeze lifecycle.
-- No historical status is invented or backfilled. Account profile updated_at is
-- a conservative boundary until a real status event is available.
CREATE TABLE public.invoice_billing_status_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coder_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id uuid,
  active boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_billing_status_events_lookup_idx ON public.invoice_billing_status_events(coder_id,class_id,changed_at DESC);
ALTER TABLE public.invoice_billing_status_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_billing_status_events FROM anon,authenticated;
GRANT SELECT,INSERT ON public.invoice_billing_status_events TO service_role;
CREATE FUNCTION public.record_invoice_billing_status_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME='users' THEN
    IF NEW.role='CODER' AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      INSERT INTO public.invoice_billing_status_events(coder_id,class_id,active) VALUES(NEW.id,NULL,NEW.is_active);
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.invoice_billing_status_events(coder_id,class_id,active) VALUES(NEW.coder_id,NEW.class_id,NEW.status='ACTIVE');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_billing_account_status AFTER UPDATE OF is_active ON public.users FOR EACH ROW EXECUTE FUNCTION public.record_invoice_billing_status_event();
CREATE TRIGGER invoice_billing_enrollment_status AFTER UPDATE OF status ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.record_invoice_billing_status_event();

CREATE TABLE public.invoice_checkout_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_ids uuid[] NOT NULL CHECK (cardinality(invoice_ids) BETWEEN 1 AND 24),
  ccr_id uuid NOT NULL REFERENCES public.ccr_numbers(id) ON DELETE RESTRICT,
  parent_phone text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  send_state text NOT NULL DEFAULT 'DRAFT' CHECK (send_state IN ('DRAFT','SENDING','SENT','UNCERTAIN')),
  sent_at timestamptz
);
CREATE INDEX invoice_checkout_links_members_idx ON public.invoice_checkout_links USING gin(invoice_ids);
CREATE TABLE public.invoice_checkout_delivery_claims (
  ccr_id uuid NOT NULL REFERENCES public.ccr_numbers(id) ON DELETE RESTRICT,
  send_day date NOT NULL,
  link_id uuid NOT NULL REFERENCES public.invoice_checkout_links(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(ccr_id,send_day)
);
ALTER TABLE public.invoice_checkout_delivery_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_checkout_delivery_claims FROM anon,authenticated;
GRANT ALL ON public.invoice_checkout_delivery_claims TO service_role;
CREATE TABLE public.invoice_checkout_intents (
  order_id text PRIMARY KEY,
  link_id uuid REFERENCES public.invoice_checkout_links(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'CREATING' CHECK (state IN ('CREATING','PENDING','PAID','CANCELLED','REVIEW')),
  method text NOT NULL,
  base_amount integer NOT NULL CHECK (base_amount > 0),
  admin_fee integer NOT NULL CHECK (admin_fee >= 0),
  total_amount integer NOT NULL CHECK (total_amount = base_amount + admin_fee),
  payment_details jsonb,
  review_reason text,
  confirmation_state text NOT NULL DEFAULT 'UNSENT' CHECK (confirmation_state IN ('UNSENT','SENDING','SENT','UNCERTAIN')),
  confirmation_notes text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoice_checkout_intents_link_idx ON public.invoice_checkout_intents(link_id, created_at DESC);
CREATE TABLE public.invoice_checkout_allocations (
  order_id text NOT NULL REFERENCES public.invoice_checkout_intents(order_id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount > 0),
  PRIMARY KEY(order_id, invoice_id)
);
CREATE INDEX invoice_checkout_allocations_invoice_idx ON public.invoice_checkout_allocations(invoice_id);
CREATE TABLE public.invoice_checkout_claims (
  invoice_id uuid PRIMARY KEY REFERENCES public.invoices(id) ON DELETE RESTRICT,
  order_id text NOT NULL REFERENCES public.invoice_checkout_intents(order_id) ON DELETE RESTRICT
);
CREATE TABLE public.invoice_checkout_grants (
  invoice_item_id uuid PRIMARY KEY REFERENCES public.invoice_items(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  order_id text NOT NULL REFERENCES public.invoice_checkout_intents(order_id) ON DELETE RESTRICT,
  payment_period_id uuid NOT NULL REFERENCES public.coder_payment_periods(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_checkout_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_checkout_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_checkout_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_checkout_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_checkout_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_checkout_links, public.invoice_checkout_intents,
  public.invoice_checkout_allocations, public.invoice_checkout_claims, public.invoice_checkout_grants FROM anon, authenticated;
GRANT ALL ON public.invoice_checkout_links, public.invoice_checkout_intents,
  public.invoice_checkout_allocations, public.invoice_checkout_claims, public.invoice_checkout_grants TO service_role;

CREATE FUNCTION public.create_invoice_checkout_link(p_ids uuid[], p_admin uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_ccr uuid; v_phone text; v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(20261021, 1);
  IF cardinality(p_ids) NOT BETWEEN 1 AND 24 OR cardinality(p_ids) <> (SELECT count(DISTINCT x) FROM unnest(p_ids) x) THEN
    RAISE EXCEPTION 'CHECKOUT_INVALID_SELECTION';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id=p_admin AND role='ADMIN' AND is_active=true) THEN RAISE EXCEPTION 'CHECKOUT_FORBIDDEN'; END IF;
  SELECT ccr_id, regexp_replace(parent_phone, '[^0-9]', '', 'g') INTO v_ccr,v_phone FROM public.invoices WHERE id=p_ids[1];
  SELECT count(*) INTO v_count FROM public.invoices WHERE id=ANY(p_ids) AND invoice_type='MONTHLY'
    AND status IN ('PENDING','OVERDUE') AND total_amount>0 AND ccr_id=v_ccr
    AND regexp_replace(parent_phone, '[^0-9]', '', 'g')=v_phone;
  IF v_count<>cardinality(p_ids) OR v_ccr IS NULL THEN RAISE EXCEPTION 'CHECKOUT_FAMILY_OR_STATUS_CHANGED'; END IF;
  SELECT id INTO v_id FROM public.invoice_checkout_links WHERE invoice_ids @> p_ids AND invoice_ids <@ p_ids
    AND ccr_id=v_ccr AND parent_phone=v_phone ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.invoice_checkout_links(invoice_ids,ccr_id,parent_phone,created_by) VALUES(p_ids,v_ccr,v_phone,p_admin) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION public.claim_invoice_checkout_message(p_link uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_link public.invoice_checkout_links; v_claim uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(20261021,1);
  SELECT * INTO STRICT v_link FROM public.invoice_checkout_links WHERE id=p_link FOR UPDATE;
  IF v_link.send_state NOT IN ('DRAFT','SENT') OR NOT EXISTS(SELECT 1 FROM public.invoices WHERE id=ANY(v_link.invoice_ids) AND status IN ('PENDING','OVERDUE')) THEN RETURN false; END IF;
  INSERT INTO public.invoice_checkout_delivery_claims(ccr_id,send_day,link_id)
    VALUES(v_link.ccr_id,(now() AT TIME ZONE 'Asia/Jakarta')::date,p_link) ON CONFLICT DO NOTHING RETURNING link_id INTO v_claim;
  IF v_claim IS NULL THEN RETURN false; END IF;
  UPDATE public.invoice_checkout_links SET send_state='SENDING' WHERE id=p_link;
  RETURN true;
END $$;

CREATE FUNCTION public.validate_invoice_checkout_periods(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE r record; v_start date; v_end date; v_duration integer; v_ranges jsonb:='[]';
BEGIN
  FOR r IN SELECT it.*,inv.period_start_date,pp.class_id,pp.coder_id AS owner_id,pp.start_date AS anchor_start,pl.duration_months AS plan_duration
    FROM public.invoice_items it JOIN public.invoices inv ON inv.id=it.invoice_id
    LEFT JOIN public.coder_payment_periods pp ON pp.id=it.payment_period_id
    LEFT JOIN public.payment_plans pl ON pl.id=pp.payment_plan_id
    WHERE it.invoice_id=ANY(p_ids) ORDER BY it.id LOOP
    v_start:=coalesce(r.billing_start_date,r.period_start_date);
    v_duration:=coalesce(r.billing_duration_months,r.plan_duration);
    v_end:=coalesce(r.billing_end_date,(v_start+make_interval(months=>v_duration)-interval '1 day')::date);
    IF r.coder_id IS NULL OR r.class_id IS NULL OR r.coder_id IS DISTINCT FROM r.owner_id OR v_start IS NULL OR v_end IS NULL
      OR v_duration IS NULL OR v_duration NOT BETWEEN 1 AND 24 OR v_start<=r.anchor_start
      OR v_end<>(v_start+make_interval(months=>v_duration)-interval '1 day')::date THEN RAISE EXCEPTION 'CHECKOUT_PERIOD_REVIEW_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM public.coder_payment_periods WHERE coder_id=r.coder_id AND class_id=r.class_id
      AND status IN ('ACTIVE','EXPIRED') AND start_date<=v_end AND end_date>=v_start)
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_ranges) x WHERE x->>'coder'=r.coder_id::text AND x->>'class'=r.class_id::text
        AND (x->>'start')::date<=v_end AND (x->>'end')::date>=v_start) THEN RAISE EXCEPTION 'CHECKOUT_PERIOD_OVERLAP'; END IF;
    v_ranges:=v_ranges||jsonb_build_array(jsonb_build_object('coder',r.coder_id,'class',r.class_id,'start',v_start,'end',v_end));
    -- Freeze missing historical metadata only at an explicitly requested charge,
    -- never as a migration backfill. Amounts and original dates remain untouched.
    IF r.billing_start_date IS NULL OR r.billing_end_date IS NULL OR r.billing_duration_months IS NULL THEN
      UPDATE public.invoice_items SET billing_start_date=v_start,billing_end_date=v_end,billing_duration_months=v_duration WHERE id=r.id;
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.reserve_invoice_checkout(p_order text, p_link uuid, p_ids uuid[], p_method text, p_base integer, p_fee integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_invoice public.invoices; v_link public.invoice_checkout_links; v_sum bigint:=0; v_count integer:=0;
BEGIN
  PERFORM pg_advisory_xact_lock(20261021,1);
  IF p_order NOT LIKE 'LMSB-%' OR cardinality(p_ids) NOT BETWEEN 1 AND 24
    OR cardinality(p_ids)<>(SELECT count(DISTINCT x) FROM unnest(p_ids) x)
    OR p_method NOT IN ('qris','bsi_va','bni_va','bri_va','permata_va','cimb_va','mandiri_bill','other_va','manual') THEN RAISE EXCEPTION 'CHECKOUT_INVALID_SELECTION'; END IF;
  IF p_link IS NOT NULL THEN
    SELECT * INTO STRICT v_link FROM public.invoice_checkout_links WHERE id=p_link;
    IF NOT v_link.invoice_ids @> p_ids THEN RAISE EXCEPTION 'CHECKOUT_OUTSIDE_LINK'; END IF;
  ELSIF cardinality(p_ids)<>1 THEN RAISE EXCEPTION 'CHECKOUT_LINK_REQUIRED'; END IF;
  FOR v_invoice IN SELECT * FROM public.invoices WHERE id=ANY(p_ids) ORDER BY id FOR UPDATE LOOP
    v_count:=v_count+1;
    IF v_invoice.invoice_type<>'MONTHLY' OR v_invoice.status NOT IN ('PENDING','OVERDUE') THEN RAISE EXCEPTION 'CHECKOUT_STATUS_CHANGED'; END IF;
    IF p_link IS NOT NULL AND (v_invoice.ccr_id IS DISTINCT FROM v_link.ccr_id OR regexp_replace(v_invoice.parent_phone,'[^0-9]','','g')<>v_link.parent_phone) THEN RAISE EXCEPTION 'CHECKOUT_FAMILY_CHANGED'; END IF;
    IF EXISTS(SELECT 1 FROM public.invoice_checkout_claims WHERE invoice_id=v_invoice.id) THEN RAISE EXCEPTION 'CHECKOUT_ALREADY_RESERVED'; END IF;
    IF v_invoice.total_amount<=0 OR v_invoice.total_amount<>(SELECT coalesce(sum(final_price),0) FROM public.invoice_items WHERE invoice_id=v_invoice.id) THEN RAISE EXCEPTION 'CHECKOUT_AMOUNT_CHANGED'; END IF;
    v_sum:=v_sum+v_invoice.total_amount;
  END LOOP;
  IF v_count<>cardinality(p_ids) OR v_sum<>p_base OR p_fee<0 THEN RAISE EXCEPTION 'CHECKOUT_AMOUNT_CHANGED'; END IF;
  IF (SELECT count(DISTINCT (period_year,period_month)) FROM public.invoices WHERE id=ANY(p_ids))<>cardinality(p_ids) THEN RAISE EXCEPTION 'CHECKOUT_DUPLICATE_BILLING_MONTH'; END IF;
  PERFORM public.validate_invoice_checkout_periods(p_ids);
  INSERT INTO public.invoice_checkout_intents(order_id,link_id,method,base_amount,admin_fee,total_amount) VALUES(p_order,p_link,p_method,p_base,p_fee,p_base+p_fee);
  INSERT INTO public.invoice_checkout_allocations(order_id,invoice_id,amount) SELECT p_order,id,total_amount FROM public.invoices WHERE id=ANY(p_ids);
  INSERT INTO public.invoice_checkout_claims(invoice_id,order_id) SELECT unnest(p_ids),p_order;
END $$;

-- Legacy invoice links, manual paid/unpaid, deletion, and generator updates obey the
-- same row lock. Only this order's settlement may modify a reserved invoice.
CREATE FUNCTION public.guard_invoice_checkout_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order text;
BEGIN
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at')=(to_jsonb(OLD)-'updated_at') THEN RETURN NEW; END IF;
  SELECT order_id INTO v_order FROM public.invoice_checkout_claims WHERE invoice_id=OLD.id;
  IF v_order IS NOT NULL AND v_order IS DISTINCT FROM current_setting('lms.checkout_settling_order',true) THEN RAISE EXCEPTION 'CHECKOUT_ALREADY_RESERVED'; END IF;
  IF EXISTS(SELECT 1 FROM public.invoice_checkout_allocations WHERE invoice_id=OLD.id) AND
    (TG_OP='DELETE' OR (NEW.status<>OLD.status AND OLD.status='PAID')) THEN RAISE EXCEPTION 'CHECKOUT_RECONCILIATION_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_checkout_invoice_guard BEFORE UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_checkout_mutation();

CREATE FUNCTION public.guard_invoice_checkout_item_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  v_id:=CASE WHEN TG_OP='INSERT' THEN NEW.invoice_id ELSE OLD.invoice_id END;
  PERFORM 1 FROM public.invoices WHERE id=v_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.invoice_checkout_claims WHERE invoice_id=v_id)
    OR EXISTS(SELECT 1 FROM public.invoice_checkout_allocations a JOIN public.invoice_checkout_intents i USING(order_id) WHERE a.invoice_id=v_id AND i.state='PAID') THEN
    RAISE EXCEPTION 'CHECKOUT_ITEMS_FROZEN';
  END IF;
  IF TG_OP='UPDATE' AND NEW.invoice_id<>OLD.invoice_id THEN RAISE EXCEPTION 'CHECKOUT_ITEM_MOVE_FORBIDDEN'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invoice_checkout_item_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_checkout_item_mutation();

CREATE FUNCTION public.finish_invoice_checkout(p_order text, p_outcome text, p_total integer, p_paid_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_intent public.invoice_checkout_intents; v_invoice public.invoices; v_item record;
  v_period public.coder_payment_periods; v_duration integer; v_start date; v_end date; v_new uuid; v_reason text;
BEGIN
  PERFORM pg_advisory_xact_lock(20261021,1);
  SELECT * INTO STRICT v_intent FROM public.invoice_checkout_intents WHERE order_id=p_order FOR UPDATE;
  IF p_total<>v_intent.total_amount THEN RAISE EXCEPTION 'CHECKOUT_GATEWAY_AMOUNT_MISMATCH'; END IF;
  IF v_intent.state='PAID' THEN RETURN jsonb_build_object('state','PAID','duplicate',true); END IF;
  IF p_outcome='PENDING' THEN RETURN jsonb_build_object('state',v_intent.state); END IF;
  IF p_outcome='CANCELLED' AND v_intent.state<>'REVIEW' THEN
    UPDATE public.invoice_checkout_intents SET state='CANCELLED' WHERE order_id=p_order;
    DELETE FROM public.invoice_checkout_claims WHERE order_id=p_order;
    RETURN jsonb_build_object('state','CANCELLED');
  END IF;
  IF p_outcome<>'PAID' OR p_paid_at IS NULL THEN RAISE EXCEPTION 'CHECKOUT_INVALID_OUTCOME'; END IF;
  -- A late settlement after cancellation/release must be reconciled, not overwrite
  -- a replacement order or silently extend access a second time.
  BEGIN
    IF v_intent.state='CANCELLED' OR (SELECT count(*) FROM public.invoice_checkout_claims WHERE order_id=p_order)<>(SELECT count(*) FROM public.invoice_checkout_allocations WHERE order_id=p_order) THEN RAISE EXCEPTION 'CHECKOUT_CLAIM_CHANGED'; END IF;
    PERFORM set_config('lms.checkout_settling_order',p_order,true);
    FOR v_invoice IN SELECT i.* FROM public.invoices i JOIN public.invoice_checkout_allocations a ON a.invoice_id=i.id WHERE a.order_id=p_order ORDER BY i.period_year,i.period_month,i.id FOR UPDATE OF i LOOP
      IF v_invoice.status='PAID' OR v_invoice.total_amount<>(SELECT amount FROM public.invoice_checkout_allocations WHERE order_id=p_order AND invoice_id=v_invoice.id) THEN RAISE EXCEPTION 'CHECKOUT_INVOICE_CHANGED'; END IF;
      FOR v_item IN SELECT * FROM public.invoice_items WHERE invoice_id=v_invoice.id ORDER BY id LOOP
        IF v_item.coder_id IS NULL OR v_item.payment_period_id IS NULL THEN RAISE EXCEPTION 'CHECKOUT_MISSING_BILLING_REFERENCE'; END IF;
        SELECT * INTO STRICT v_period FROM public.coder_payment_periods WHERE id=v_item.payment_period_id;
        IF v_period.coder_id IS DISTINCT FROM v_item.coder_id OR v_period.class_id IS NULL THEN RAISE EXCEPTION 'CHECKOUT_PERIOD_OWNER_CHANGED'; END IF;
        SELECT coalesce(v_item.billing_duration_months,duration_months) INTO v_duration FROM public.payment_plans WHERE id=v_period.payment_plan_id;
        v_start:=coalesce(v_item.billing_start_date,v_invoice.period_start_date);
        v_end:=coalesce(v_item.billing_end_date,(v_start+make_interval(months=>v_duration)-interval '1 day')::date);
        IF v_duration IS NULL OR v_duration NOT BETWEEN 1 AND 24 OR v_start IS NULL OR v_end IS NULL OR v_start>v_end
          OR v_start<=v_period.start_date OR v_end<>(v_start+make_interval(months=>v_duration)-interval '1 day')::date THEN RAISE EXCEPTION 'CHECKOUT_PERIOD_REVIEW_REQUIRED'; END IF;
        IF EXISTS(SELECT 1 FROM public.coder_payment_periods WHERE coder_id=v_item.coder_id AND class_id=v_period.class_id
          AND status IN ('ACTIVE','EXPIRED') AND start_date<=v_end AND end_date>=v_start) THEN RAISE EXCEPTION 'CHECKOUT_PERIOD_OVERLAP'; END IF;
        UPDATE public.coder_payment_periods SET status='EXPIRED' WHERE coder_id=v_item.coder_id AND class_id=v_period.class_id AND status='ACTIVE' AND end_date<(now() AT TIME ZONE 'Asia/Jakarta')::date;
        INSERT INTO public.coder_payment_periods(coder_id,class_id,payment_plan_id,pricing_id,start_date,end_date,total_amount,status)
          VALUES(v_item.coder_id,v_period.class_id,v_period.payment_plan_id,v_period.pricing_id,v_start,v_end,v_item.final_price,
            CASE WHEN v_end<(now() AT TIME ZONE 'Asia/Jakarta')::date THEN 'EXPIRED' ELSE 'ACTIVE' END) RETURNING id INTO v_new;
        INSERT INTO public.invoice_checkout_grants(invoice_item_id,invoice_id,order_id,payment_period_id) VALUES(v_item.id,v_invoice.id,p_order,v_new);
      END LOOP;
      UPDATE public.invoices SET status='PAID',paid_at=p_paid_at,paid_notes=coalesce(v_intent.confirmation_notes,CASE WHEN v_intent.method='manual' THEN 'Dikonfirmasi manual ' ELSE 'Dibayar via Midtrans ' END||p_order) WHERE id=v_invoice.id;
    END LOOP;
    UPDATE public.invoice_checkout_intents SET state='PAID',paid_at=p_paid_at,review_reason=NULL WHERE order_id=p_order;
    DELETE FROM public.invoice_checkout_claims WHERE order_id=p_order;
    RETURN jsonb_build_object('state','PAID','duplicate',false);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_reason=MESSAGE_TEXT;
    UPDATE public.invoice_checkout_intents SET state='REVIEW',review_reason=left(v_reason,300) WHERE order_id=p_order;
    RETURN jsonb_build_object('state','REVIEW');
  END;
END $$;

-- Generator transaction: invoice obligations may exist before payment. One parent
-- per billing month, missing coder items only; never grant access here.
CREATE FUNCTION public.upsert_invoice_billing_cycle(p_invoice jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_status text; v_item jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(20261021,1);
  SELECT id,status::text INTO v_id,v_status FROM public.invoices WHERE ccr_id=(p_invoice->>'ccr_id')::uuid
    AND period_month=(p_invoice->>'period_month')::integer AND period_year=(p_invoice->>'period_year')::integer AND invoice_type='MONTHLY' FOR UPDATE;
  -- An already issued invoice is immutable here, even when its historic gateway
  -- attempt lives only in shared file storage. Never silently change its amount.
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('id',v_id,'created',false); END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Serialize with the existing activation controls. A concurrent leave/stop
    -- must not slip through between the application read and invoice insertion.
    PERFORM 1 FROM public.coder_payment_periods p
      JOIN public.users u ON u.id=p.coder_id
      JOIN public.enrollments e ON e.coder_id=p.coder_id AND e.class_id=p.class_id
      JOIN public.classes c ON c.id=p.class_id
      WHERE p.id=(v_item->>'payment_period_id')::uuid AND p.coder_id=(v_item->>'coder_id')::uuid
        AND u.is_active=true AND u.role='CODER' AND e.status='ACTIVE'
        AND c.lifecycle_status='ACTIVE' AND c.archived_at IS NULL
      FOR SHARE OF u,e,c;
    IF NOT FOUND THEN RAISE EXCEPTION 'BILLING_STATUS_CHANGED'; END IF;
  END LOOP;
  IF v_id IS NULL THEN
    INSERT INTO public.invoices(invoice_number,ccr_id,parent_phone,parent_name,period_month,period_year,period_start_date,period_end_date,total_amount,status,invoice_type,due_date)
      VALUES(p_invoice->>'invoice_number',(p_invoice->>'ccr_id')::uuid,p_invoice->>'parent_phone',p_invoice->>'parent_name',
        (p_invoice->>'period_month')::integer,(p_invoice->>'period_year')::integer,(p_invoice->>'period_start_date')::date,
        (p_invoice->>'period_end_date')::date,0,'PENDING','MONTHLY',(p_invoice->>'due_date')::date) RETURNING id INTO v_id;
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NOT EXISTS(SELECT 1 FROM public.invoice_items WHERE invoice_id=v_id AND coder_id=(v_item->>'coder_id')::uuid) THEN
      INSERT INTO public.invoice_items(invoice_id,coder_id,coder_name,class_name,level_name,base_price,discount_amount,final_price,payment_period_id,billing_start_date,billing_end_date,billing_duration_months)
        VALUES(v_id,(v_item->>'coder_id')::uuid,v_item->>'coder_name',v_item->>'class_name',v_item->>'level_name',
          (v_item->>'base_price')::integer,(v_item->>'discount_amount')::integer,(v_item->>'final_price')::integer,
          (v_item->>'payment_period_id')::uuid,(v_item->>'billing_start_date')::date,(v_item->>'billing_end_date')::date,(v_item->>'billing_duration_months')::integer);
    END IF;
  END LOOP;
  UPDATE public.invoices SET total_amount=(SELECT sum(final_price) FROM public.invoice_items WHERE invoice_id=v_id) WHERE id=v_id;
  RETURN jsonb_build_object('id',v_id,'created',true);
END $$;

REVOKE ALL ON FUNCTION public.create_invoice_checkout_link(uuid[],uuid), public.reserve_invoice_checkout(text,uuid,uuid[],text,integer,integer),
  public.finish_invoice_checkout(text,text,integer,timestamptz), public.upsert_invoice_billing_cycle(jsonb,jsonb),
  public.guard_invoice_checkout_mutation(),public.guard_invoice_checkout_item_mutation() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_invoice_billing_status_event() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.validate_invoice_checkout_periods(uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_invoice_checkout_message(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invoice_checkout_message(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_invoice_checkout_link(uuid[],uuid), public.reserve_invoice_checkout(text,uuid,uuid[],text,integer,integer),
  public.finish_invoice_checkout(text,text,integer,timestamptz), public.upsert_invoice_billing_cycle(jsonb,jsonb) TO service_role;
COMMIT;
