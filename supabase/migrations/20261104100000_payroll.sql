-- Additive payroll module. Existing classes retain NULL so Admin explicitly classifies
-- fulltime assignments; no attendance, salary, user or WhatsApp data is migrated/reset.
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS payroll_mode text
  CHECK (payroll_mode IN ('MITRA', 'FULLTIME'));
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS payroll_mode text
  CHECK (payroll_mode IN ('MITRA', 'FULLTIME'));

CREATE TABLE public.payroll_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('COACH','STAFF')),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  job_title text NOT NULL DEFAULT '',
  staff_phone text,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'COACH' OR staff_phone IS NULL)
);
CREATE TABLE public.payroll_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.payroll_profiles(id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  contract text NOT NULL CHECK (contract IN ('MITRA','FULLTIME')),
  base_salary bigint NOT NULL DEFAULT 0 CHECK (base_salary BETWEEN 0 AND 1000000000000),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, effective_from)
);
CREATE TABLE public.payroll_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from date NOT NULL UNIQUE,
  rates jsonb NOT NULL CHECK (jsonb_typeof(rates) = 'object'),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payroll_rate_cards(effective_from, rates) VALUES ('2000-01-01',
  '{"WEEKLY_ONLINE":[70000,80000,100000],"WEEKLY_OFFLINE":[95000,105000,125000],"EKSKUL_ONLINE":[70000,80000,100000],"EKSKUL_OFFLINE":[95000,105000,125000],"TRIAL":25000,"GOAL":100000,"EVENT":180000,"TRAINING_ONLINE":25000,"TRAINING_OFFLINE":50000,"OBSERVATION_ONLINE":25000,"OBSERVATION_OFFLINE":50000}');
CREATE TABLE public.payroll_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_from date,
  automation_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.payroll_settings(id) VALUES (1);
CREATE TABLE public.payroll_periods (
  id text PRIMARY KEY CHECK (id ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object' AND document->>'id' = id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payroll_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_key text NOT NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  revision integer,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payroll_audit_entity_created ON public.payroll_audit(entity_key, created_at DESC);
CREATE INDEX payroll_terms_profile_effective ON public.payroll_terms(profile_id, effective_from DESC);

-- Financial state changes use compare-and-swap and append their audit row in the
-- same transaction. A stale browser/cron/send request cannot overwrite a newer one.
CREATE FUNCTION public.payroll_commit_period(
  p_id text, p_expected_revision integer, p_document jsonb,
  p_actor_id uuid, p_action text, p_reason text DEFAULT ''
) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE next_revision integer; old_document jsonb;
BEGIN
  IF p_document->>'id' IS DISTINCT FROM p_id OR jsonb_typeof(p_document) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payroll period document';
  END IF;
  SELECT document INTO old_document FROM public.payroll_periods
    WHERE id = p_id AND revision = p_expected_revision FOR UPDATE;
  IF old_document IS NULL THEN RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE = '40001'; END IF;
  UPDATE public.payroll_periods SET document = p_document, revision = revision + 1, updated_at = now()
    WHERE id = p_id AND revision = p_expected_revision RETURNING revision INTO next_revision;
  IF next_revision IS NULL THEN RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.payroll_audit(entity_key, action, actor_id, reason, revision, before_data, after_data)
    VALUES ('period:' || p_id, p_action, p_actor_id, p_reason, next_revision,
      old_document - 'slips' - 'history', p_document - 'slips' - 'history');
  RETURN next_revision;
END;
$$;
CREATE FUNCTION public.payroll_period_guard() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE entry jsonb; candidate jsonb;
BEGIN
  IF NEW.id <> OLD.id OR NEW.document->>'starts_at' IS DISTINCT FROM OLD.document->>'starts_at'
    OR NEW.document->>'ends_at' IS DISTINCT FROM OLD.document->>'ends_at'
    OR NEW.document->>'correction_deadline' IS DISTINCT FROM OLD.document->>'correction_deadline' THEN
    RAISE EXCEPTION 'Payroll period boundaries are immutable';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(OLD.document->'history') LOOP
    SELECT value INTO candidate FROM jsonb_array_elements(NEW.document->'history') WHERE value->>'version' = entry->>'version';
    IF candidate IS DISTINCT FROM entry THEN RAISE EXCEPTION 'Final payroll history is immutable'; END IF;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(OLD.document->'transfers') LOOP
    SELECT value INTO candidate FROM jsonb_array_elements(NEW.document->'transfers') WHERE value->>'id' = entry->>'id';
    IF candidate IS DISTINCT FROM entry THEN RAISE EXCEPTION 'Payroll transfer history is immutable'; END IF;
  END LOOP;
  IF OLD.document->>'status' = 'FINAL' AND NEW.document->>'status' = 'FINAL'
    AND OLD.document->>'version' = NEW.document->>'version'
    AND NEW.document->'slips' IS DISTINCT FROM OLD.document->'slips' THEN
    RAISE EXCEPTION 'Reopen a new revision before changing finalized slips';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payroll_period_immutable_history BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.payroll_period_guard();

CREATE FUNCTION public.payroll_save_profile(p_profile jsonb, p_term jsonb, p_actor_id uuid)
  RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE target uuid; existing public.payroll_profiles; linked_user uuid; profile_name text;
BEGIN
  target := COALESCE(NULLIF(p_profile->>'id','')::uuid, gen_random_uuid());
  linked_user := CASE WHEN p_profile->>'kind' = 'COACH' THEN (p_profile->>'user_id')::uuid ELSE NULL END;
  profile_name := p_profile->>'name';
  IF p_profile->>'kind' = 'COACH' THEN
    SELECT full_name INTO profile_name FROM public.users WHERE id = linked_user AND role = 'COACH';
    IF profile_name IS NULL THEN RAISE EXCEPTION 'Coach account is invalid'; END IF;
  END IF;
  IF p_profile->>'id' IS NOT NULL THEN
    SELECT * INTO existing FROM public.payroll_profiles WHERE id = target FOR UPDATE;
    IF NOT FOUND OR existing.kind <> p_profile->>'kind' OR existing.user_id IS DISTINCT FROM linked_user THEN
      RAISE EXCEPTION 'Payroll recipient identity cannot be reassigned';
    END IF;
  END IF;
  INSERT INTO public.payroll_profiles(id,user_id,kind,name,job_title,staff_phone,active,updated_by)
    VALUES (target,linked_user,p_profile->>'kind',profile_name,COALESCE(p_profile->>'job_title',''),
      CASE WHEN p_profile->>'kind' = 'STAFF' THEN p_profile->>'staff_phone' ELSE NULL END,
      COALESCE((p_profile->>'active')::boolean,true),p_actor_id)
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,job_title=EXCLUDED.job_title,staff_phone=EXCLUDED.staff_phone,active=EXCLUDED.active,updated_by=p_actor_id;
  INSERT INTO public.payroll_terms(profile_id,effective_from,contract,base_salary,updated_by)
    VALUES (target,(p_term->>'effective_from')::date,p_term->>'contract',(p_term->>'base_salary')::bigint,p_actor_id)
    ON CONFLICT(profile_id,effective_from) DO UPDATE SET contract=EXCLUDED.contract,base_salary=EXCLUDED.base_salary,updated_by=p_actor_id;
  RETURN target;
END;
$$;
CREATE FUNCTION public.payroll_config_audit() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
BEGIN
  NEW.updated_at := now();
  INSERT INTO public.payroll_audit(entity_key, action, actor_id, before_data, after_data)
    VALUES (TG_TABLE_NAME || ':' || NEW.id::text, TG_OP, NEW.updated_by,
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END, to_jsonb(NEW));
  RETURN NEW;
END;
$$;
CREATE TRIGGER payroll_profiles_audit BEFORE INSERT OR UPDATE ON public.payroll_profiles FOR EACH ROW EXECUTE FUNCTION public.payroll_config_audit();
CREATE TRIGGER payroll_terms_audit BEFORE INSERT OR UPDATE ON public.payroll_terms FOR EACH ROW EXECUTE FUNCTION public.payroll_config_audit();
CREATE TRIGGER payroll_rates_audit BEFORE INSERT OR UPDATE ON public.payroll_rate_cards FOR EACH ROW EXECUTE FUNCTION public.payroll_config_audit();
CREATE TRIGGER payroll_settings_audit BEFORE INSERT OR UPDATE ON public.payroll_settings FOR EACH ROW EXECUTE FUNCTION public.payroll_config_audit();

CREATE FUNCTION public.payroll_set_class_mode(p_class_id uuid, p_mode text, p_actor_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE previous_mode text;
BEGIN
  IF p_mode NOT IN ('MITRA','FULLTIME') THEN RAISE EXCEPTION 'Invalid payroll class mode'; END IF;
  SELECT payroll_mode INTO previous_mode FROM public.classes WHERE id=p_class_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Class not found'; END IF;
  UPDATE public.classes SET payroll_mode=p_mode WHERE id=p_class_id;
  INSERT INTO public.payroll_audit(entity_key,action,actor_id,before_data,after_data)
    VALUES ('class:'||p_class_id,'CLASS_MODE',p_actor_id,jsonb_build_object('mode',previous_mode),jsonb_build_object('mode',p_mode));
END;
$$;
REVOKE ALL ON FUNCTION public.payroll_set_class_mode(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_set_class_mode(uuid,text,uuid) TO service_role;

-- Browser roles get no direct financial table/RPC access. NextAuth ownership and
-- Admin menu permissions are enforced in server endpoints; server-only DAOs use
-- the existing service-role client. Coach responses are filtered before return.
ALTER TABLE public.payroll_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_profiles, public.payroll_terms, public.payroll_rate_cards,
  public.payroll_settings, public.payroll_periods, public.payroll_audit FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.payroll_profiles, public.payroll_terms,
  public.payroll_rate_cards, public.payroll_settings, public.payroll_periods TO service_role;
GRANT SELECT, INSERT ON public.payroll_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payroll_audit_id_seq TO service_role;
REVOKE ALL ON FUNCTION public.payroll_commit_period(text,integer,jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_commit_period(text,integer,jsonb,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.payroll_config_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_config_audit() TO service_role;
REVOKE ALL ON FUNCTION public.payroll_period_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_period_guard() TO service_role;
REVOKE ALL ON FUNCTION public.payroll_save_profile(jsonb,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_save_profile(jsonb,jsonb,uuid) TO service_role;

-- Replaces the coach-submitted Tally counters with dated, reviewed activities.
CREATE TABLE public.payroll_activity_requests (
  id uuid PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  activity_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('EVENT','OBSERVATION_ONLINE','OBSERVATION_OFFLINE','TRAINING_ONLINE','TRAINING_OFFLINE')),
  label text NOT NULL CHECK (length(trim(label)) BETWEEN 3 AND 160),
  notes text NOT NULL CHECK (length(trim(notes)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  mode text NOT NULL DEFAULT 'MITRA' CHECK (mode IN ('MITRA','FULLTIME')),
  revision integer NOT NULL DEFAULT 0,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payroll_activity_request_no_duplicates ON public.payroll_activity_requests(coach_id,activity_at,kind,lower(trim(label)));
CREATE INDEX payroll_activity_request_period ON public.payroll_activity_requests(activity_at,status);
ALTER TABLE public.payroll_activity_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_activity_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON public.payroll_activity_requests TO service_role;

CREATE FUNCTION public.payroll_review_activity(p_id uuid,p_expected_revision integer,p_status text,p_mode text,p_reason text,p_period_id text,p_actor_id uuid)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE request public.payroll_activity_requests; period public.payroll_periods; next_document jsonb;
BEGIN
  IF p_status NOT IN ('APPROVED','REJECTED') OR p_mode NOT IN ('MITRA','FULLTIME') OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid review';
  END IF;
  SELECT * INTO request FROM public.payroll_activity_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR request.revision <> p_expected_revision THEN RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE='40001'; END IF;
  SELECT * INTO period FROM public.payroll_periods WHERE id=p_period_id FOR UPDATE;
  IF NOT FOUND OR request.activity_at < (period.document->>'starts_at')::timestamptz OR request.activity_at >= (period.document->>'ends_at')::timestamptz THEN
    RAISE EXCEPTION 'Activity period mismatch';
  END IF;
  IF period.document->>'status' <> 'DRAFT' OR EXISTS(SELECT 1 FROM jsonb_each(period.document->'deliveries') d WHERE d.value->>'status'='SENDING') THEN
    RAISE EXCEPTION 'Reopen payroll period before reviewing activity';
  END IF;
  UPDATE public.payroll_activity_requests SET status=p_status,mode=p_mode,review_reason=p_reason,
    reviewed_by=p_actor_id,reviewed_at=now(),revision=revision+1 WHERE id=p_id;
  INSERT INTO public.payroll_audit(entity_key,action,actor_id,reason,before_data,after_data)
    VALUES ('request:'||p_id,'ACTIVITY_REVIEW',p_actor_id,p_reason,to_jsonb(request),jsonb_build_object('status',p_status,'mode',p_mode,'revision',request.revision+1));
  next_document := jsonb_set(period.document,'{calculated_at}','null'::jsonb);
  PERFORM public.payroll_commit_period(p_period_id,period.revision,next_document,p_actor_id,'ACTIVITY_REVIEW',request.label||': '||p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.payroll_review_activity(uuid,integer,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_review_activity(uuid,integer,text,text,text,text,uuid) TO service_role;
