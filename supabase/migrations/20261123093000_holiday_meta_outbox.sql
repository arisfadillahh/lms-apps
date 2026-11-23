BEGIN;
CREATE TABLE public.holiday_class_meta_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_id uuid NOT NULL REFERENCES public.holiday_class_registrations(id) ON DELETE CASCADE,
  event_name text NOT NULL CHECK(event_name IN ('CompleteRegistration','InitiateCheckout','Purchase')),
  event_id text NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  value integer CHECK(value >= 0),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  UNIQUE(event_name,event_id)
);
CREATE INDEX holiday_meta_due_idx ON public.holiday_class_meta_outbox(next_attempt_at) WHERE sent_at IS NULL;
ALTER TABLE public.holiday_class_meta_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.holiday_class_meta_outbox FROM public,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON public.holiday_class_meta_outbox TO service_role;
REVOKE ALL ON SEQUENCE public.holiday_class_meta_outbox_id_seq FROM public,anon,authenticated,service_role;
GRANT USAGE ON SEQUENCE public.holiday_class_meta_outbox_id_seq TO service_role;
CREATE FUNCTION public.claim_holiday_meta_events() RETURNS SETOF public.holiday_class_meta_outbox
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  WITH due AS (
    SELECT id FROM public.holiday_class_meta_outbox
    WHERE sent_at IS NULL AND attempts<12 AND next_attempt_at<=now()
      AND (claimed_at IS NULL OR claimed_at<now()-interval '10 minutes')
    ORDER BY id LIMIT 12 FOR UPDATE SKIP LOCKED
  ) UPDATE public.holiday_class_meta_outbox e SET claimed_at=now(),attempts=e.attempts+1
    FROM due WHERE e.id=due.id RETURNING e.*;
$$;
REVOKE ALL ON FUNCTION public.claim_holiday_meta_events() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_holiday_meta_events() TO service_role;

CREATE FUNCTION public.queue_holiday_registration_meta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.attribution->>'measurement'='true' THEN
    INSERT INTO public.holiday_class_meta_outbox(registration_id,event_name,event_id,event_time,value)
      SELECT NEW.id,'CompleteRegistration',NEW.id::text,NEW.created_at,i.total_amount
      FROM public.invoices i WHERE i.id=NEW.invoice_id ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_holiday_registration_meta() FROM public,anon,authenticated,service_role;
CREATE TRIGGER holiday_registration_meta AFTER INSERT ON public.holiday_class_registrations
  FOR EACH ROW EXECUTE FUNCTION public.queue_holiday_registration_meta();

CREATE FUNCTION public.queue_holiday_checkout_meta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.invoice_number ~ '^HC-2627-[0-9]{6,}$' AND NEW.payment_method IS NOT NULL AND NEW.payment_total_amount>0 THEN
    INSERT INTO public.holiday_class_meta_outbox(registration_id,event_name,event_id,value)
      SELECT r.id,'InitiateCheckout','checkout:'||NEW.invoice_number,NEW.payment_total_amount
      FROM public.holiday_class_registrations r WHERE r.invoice_id=NEW.id AND r.attribution->>'measurement'='true'
      ON CONFLICT(event_name,event_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_holiday_checkout_meta() FROM public,anon,authenticated,service_role;
CREATE TRIGGER holiday_checkout_meta AFTER UPDATE OF payment_total_amount,payment_method ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.queue_holiday_checkout_meta();

CREATE FUNCTION public.settle_holiday_class_invoice_measured(p_order text,p_amount integer,p_gross integer,p_paid_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_registration uuid;
BEGIN
  IF p_gross<p_amount THEN RAISE EXCEPTION 'HOLIDAY_PAYMENT_MISMATCH'; END IF;
  v_registration:=public.settle_holiday_class_invoice(p_order,p_amount,p_paid_at);
  INSERT INTO public.holiday_class_meta_outbox(registration_id,event_name,event_id,event_time,value)
    SELECT r.id,'Purchase',i.invoice_number,p_paid_at,p_gross FROM public.holiday_class_registrations r
      JOIN public.invoices i ON i.id=r.invoice_id
      WHERE r.id=v_registration AND r.attribution->>'measurement'='true'
    ON CONFLICT(event_name,event_id) DO NOTHING;
  RETURN v_registration;
END; $$;
REVOKE ALL ON FUNCTION public.settle_holiday_class_invoice_measured(text,integer,integer,timestamptz) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_holiday_class_invoice_measured(text,integer,integer,timestamptz) TO service_role;
COMMIT;
