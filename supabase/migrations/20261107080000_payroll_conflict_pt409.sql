-- Replace live payroll RPC definitions with a non-retryable PostgREST conflict SQLSTATE.
-- Function bodies and attributes match production pg_get_functiondef except the conflict SQLSTATE.
BEGIN;

CREATE OR REPLACE FUNCTION public.payroll_commit_period(p_id text, p_expected_revision integer, p_document jsonb, p_actor_id uuid, p_action text, p_reason text DEFAULT ''::text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE next_revision integer; old_document jsonb;
BEGIN
  IF p_document->>'id' IS DISTINCT FROM p_id OR jsonb_typeof(p_document) <> 'object' THEN
    RAISE EXCEPTION 'Invalid payroll period document';
  END IF;
  SELECT document INTO old_document FROM public.payroll_periods
    WHERE id = p_id AND revision = p_expected_revision FOR UPDATE;
  IF old_document IS NULL THEN RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE = 'PT409'; END IF;
  UPDATE public.payroll_periods SET document = p_document, revision = revision + 1, updated_at = now()
    WHERE id = p_id AND revision = p_expected_revision RETURNING revision INTO next_revision;
  IF next_revision IS NULL THEN RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE = 'PT409'; END IF;
  INSERT INTO public.payroll_audit(entity_key, action, actor_id, reason, revision, before_data, after_data)
    VALUES ('period:' || p_id, p_action, p_actor_id, p_reason, next_revision,
      old_document - 'slips' - 'history', p_document - 'slips' - 'history');
  RETURN next_revision;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.payroll_review_activity(p_id uuid, p_expected_revision integer, p_status text, p_mode text, p_reason text, p_period_id text, p_actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE request public.payroll_activity_requests; period public.payroll_periods; next_document jsonb;
BEGIN
  IF p_status NOT IN ('APPROVED','REJECTED') OR p_mode NOT IN ('MITRA','FULLTIME') OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid review';
  END IF;
  SELECT * INTO request FROM public.payroll_activity_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR request.revision <> p_expected_revision THEN RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE='PT409'; END IF;
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
$function$
;

CREATE OR REPLACE FUNCTION public.payroll_submit_reimbursement(p_id uuid, p_profile_id uuid, p_period_id text, p_title text, p_amount bigint, p_evidence_path text, p_evidence_bytes integer, p_content_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
    RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE='PT409';
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
END $function$
;

CREATE OR REPLACE FUNCTION public.payroll_review_reimbursement(p_id uuid, p_expected_revision integer, p_status text, p_reason text, p_actor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
    RAISE EXCEPTION 'PAYROLL_CONFLICT' USING ERRCODE='PT409';
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
END $function$
;

REVOKE ALL ON FUNCTION public.payroll_commit_period(text,integer,jsonb,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_commit_period(text,integer,jsonb,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.payroll_review_activity(uuid,integer,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_review_activity(uuid,integer,text,text,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.payroll_submit_reimbursement(uuid,uuid,text,text,bigint,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_submit_reimbursement(uuid,uuid,text,text,bigint,text,integer,text) TO service_role;
REVOKE ALL ON FUNCTION public.payroll_review_reimbursement(uuid,integer,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_review_reimbursement(uuid,integer,text,text,uuid) TO service_role;

COMMIT;
