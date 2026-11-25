-- A single recipient may have a later reimbursement-only deadline in a draft.
-- Preserve the period deadline, request deduplication, storage scope, and service-role grant.
CREATE OR REPLACE FUNCTION public.payroll_submit_reimbursement(p_id uuid, p_profile_id uuid, p_period_id text, p_title text, p_amount bigint, p_evidence_path text, p_evidence_bytes integer, p_content_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE period public.payroll_periods; existing public.payroll_reimbursements; created public.payroll_reimbursements; regular_deadline timestamptz; extension_deadline timestamptz;
BEGIN
  -- Lock the period first in both submit/review, keeping deadline/finalization atomic.
  SELECT * INTO period FROM public.payroll_periods WHERE id=p_period_id FOR UPDATE;
  IF NOT FOUND OR period.document->>'status' <> 'DRAFT' THEN
    RAISE EXCEPTION 'REIMBURSEMENT_CLOSED';
  END IF;
  regular_deadline := (period.document->>'correction_deadline')::timestamptz;
  IF period.document->'reimbursement_extension'->>'profile_id' = p_profile_id::text THEN
    extension_deadline := (period.document->'reimbursement_extension'->>'expires_at')::timestamptz;
    IF extension_deadline > regular_deadline AND extension_deadline <= (period.document->>'ends_at')::timestamptz THEN
      regular_deadline := extension_deadline;
    END IF;
  END IF;
  IF now() >= regular_deadline THEN
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

REVOKE ALL ON FUNCTION public.payroll_submit_reimbursement(uuid,uuid,text,text,bigint,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_submit_reimbursement(uuid,uuid,text,text,bigint,text,integer,text) TO service_role;
