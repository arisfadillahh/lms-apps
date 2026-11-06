-- No existing payroll rows are changed. Public links are verified by the server;
-- anonymous/authenticated PostgREST and Storage clients cannot access evidence.
CREATE TABLE public.payroll_reimbursements (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.payroll_profiles(id) ON DELETE RESTRICT,
  period_id text NOT NULL REFERENCES public.payroll_periods(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  amount bigint NOT NULL CHECK (amount BETWEEN 1 AND 1000000000),
  evidence_path text NOT NULL UNIQUE CHECK (evidence_path ~ '^[0-9]{4}-(0[1-9]|1[0-2])/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  evidence_bytes integer NOT NULL CHECK (evidence_bytes BETWEEN 1 AND 3145728),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_reason text,
  UNIQUE (profile_id, period_id, content_hash)
);
CREATE INDEX payroll_reimbursements_period_status ON public.payroll_reimbursements(period_id, status, created_at);
CREATE INDEX payroll_reimbursements_profile_period ON public.payroll_reimbursements(profile_id, period_id, created_at);
ALTER TABLE public.payroll_reimbursements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_reimbursements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.payroll_reimbursements TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('payroll-reimbursements-private','payroll-reimbursements-private',false,3145728,ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id='payroll-reimbursements-private' AND public) THEN
    RAISE EXCEPTION 'Payroll reimbursement bucket must be private';
  END IF;
END $$;
-- Restrictive policy also closes any pre-existing broad authenticated policy.
CREATE POLICY payroll_reimbursement_evidence_private ON storage.objects AS RESTRICTIVE
FOR ALL TO anon, authenticated USING (bucket_id <> 'payroll-reimbursements-private')
WITH CHECK (bucket_id <> 'payroll-reimbursements-private');

CREATE FUNCTION public.payroll_submit_reimbursement(
  p_id uuid,p_profile_id uuid,p_period_id text,p_title text,p_amount bigint,
  p_evidence_path text,p_evidence_bytes integer,p_content_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE period public.payroll_periods; existing public.payroll_reimbursements; created public.payroll_reimbursements;
BEGIN
  -- Lock the period first in both submit/review, keeping deadline/finalization atomic.
  SELECT * INTO period FROM public.payroll_periods WHERE id=p_period_id FOR UPDATE;
  IF NOT FOUND OR period.document->>'status' <> 'DRAFT' OR now() >= (period.document->>'correction_deadline')::timestamptz THEN
    RAISE EXCEPTION 'REIMBURSEMENT_CLOSED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payroll_profiles WHERE id=p_profile_id AND active) THEN RAISE EXCEPTION 'REIMBURSEMENT_CLOSED'; END IF;
  SELECT * INTO existing FROM public.payroll_reimbursements WHERE id=p_id;
  IF FOUND THEN
    IF existing.profile_id=p_profile_id AND existing.period_id=p_period_id AND existing.content_hash=p_content_hash THEN RETURN to_jsonb(existing); END IF;
    RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE='40001';
  END IF;
  SELECT * INTO existing FROM public.payroll_reimbursements WHERE profile_id=p_profile_id AND period_id=p_period_id AND content_hash=p_content_hash;
  IF FOUND THEN RETURN to_jsonb(existing); END IF;
  IF (SELECT count(*) FROM public.payroll_reimbursements WHERE profile_id=p_profile_id AND period_id=p_period_id) >= 30 THEN RAISE EXCEPTION 'REIMBURSEMENT_LIMIT'; END IF;
  IF p_evidence_path NOT LIKE p_period_id||'/'||p_profile_id::text||'/%' THEN RAISE EXCEPTION 'Invalid evidence scope'; END IF;
  INSERT INTO public.payroll_reimbursements(id,profile_id,period_id,title,amount,evidence_path,evidence_bytes,content_hash)
    VALUES(p_id,p_profile_id,p_period_id,trim(p_title),p_amount,p_evidence_path,p_evidence_bytes,p_content_hash) RETURNING * INTO created;
  INSERT INTO public.payroll_audit(entity_key,action,reason,after_data)
    VALUES('reimbursement:'||p_id,'REIMBURSEMENT_SUBMIT','Public scoped reimbursement link',to_jsonb(created)-'evidence_path'-'content_hash');
  RETURN to_jsonb(created);
END $$;

CREATE FUNCTION public.payroll_review_reimbursement(p_id uuid,p_expected_revision integer,p_status text,p_reason text,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_catalog AS $$
DECLARE request public.payroll_reimbursements; period public.payroll_periods; next_document jsonb; components jsonb; reviewed public.payroll_reimbursements;
BEGIN
  IF p_actor_id IS NULL OR p_status NOT IN ('APPROVED','REJECTED') OR length(trim(p_reason)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
  SELECT * INTO request FROM public.payroll_reimbursements WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'REIMBURSEMENT_NOT_FOUND'; END IF;
  SELECT * INTO period FROM public.payroll_periods WHERE id=request.period_id FOR UPDATE;
  SELECT * INTO request FROM public.payroll_reimbursements WHERE id=p_id FOR UPDATE;
  IF period.document->>'status' <> 'DRAFT' OR EXISTS(SELECT 1 FROM jsonb_each(COALESCE(period.document->'deliveries','{}')) d WHERE d.value->>'status'='SENDING') THEN RAISE EXCEPTION 'REIMBURSEMENT_REOPEN'; END IF;
  IF request.revision <> p_expected_revision THEN
    IF request.revision=p_expected_revision+1 AND request.status=p_status AND request.review_reason=trim(p_reason) THEN RETURN to_jsonb(request); END IF;
    RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE='40001';
  END IF;
  IF p_status='APPROVED' AND NOT EXISTS(SELECT 1 FROM public.payroll_profiles WHERE id=request.profile_id AND active) THEN RAISE EXCEPTION 'REIMBURSEMENT_INACTIVE'; END IF;
  SELECT COALESCE(jsonb_agg(component),'[]'::jsonb) INTO components
    FROM jsonb_array_elements(COALESCE(period.document->'manual','[]')) component
    WHERE component->>'id' <> 'reimbursement:'||p_id;
  IF p_status='APPROVED' THEN
    components := components || jsonb_build_array(jsonb_build_object('id','reimbursement:'||p_id,'profile_id',request.profile_id,'date',period.document->>'correction_deadline','label','Reimbursement · '||request.title,'amount',request.amount,'reason',trim(p_reason)));
  END IF;
  next_document := jsonb_set(jsonb_set(period.document,'{manual}',components),'{calculated_at}','null'::jsonb);
  UPDATE public.payroll_reimbursements SET status=p_status,review_reason=trim(p_reason),reviewed_by=p_actor_id,reviewed_at=now(),revision=revision+1 WHERE id=p_id RETURNING * INTO reviewed;
  INSERT INTO public.payroll_audit(entity_key,action,actor_id,reason,before_data,after_data)
    VALUES('reimbursement:'||p_id,'REIMBURSEMENT_REVIEW',p_actor_id,trim(p_reason),to_jsonb(request)-'evidence_path'-'content_hash',to_jsonb(reviewed)-'evidence_path'-'content_hash');
  PERFORM public.payroll_commit_period(period.id,period.revision,next_document,p_actor_id,'REIMBURSEMENT_REVIEW',request.title||': '||trim(p_reason));
  RETURN to_jsonb(reviewed);
END $$;
REVOKE ALL ON FUNCTION public.payroll_submit_reimbursement(uuid,uuid,text,text,bigint,text,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.payroll_review_reimbursement(uuid,integer,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_submit_reimbursement(uuid,uuid,text,text,bigint,text,integer,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.payroll_review_reimbursement(uuid,integer,text,text,uuid) TO service_role;
