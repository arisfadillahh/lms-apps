-- Recurring staff allowances share the dated contract and its audit history.
ALTER TABLE public.payroll_terms ADD COLUMN IF NOT EXISTS position_allowance bigint NOT NULL DEFAULT 0 CHECK (position_allowance BETWEEN 0 AND 1000000000000);
ALTER TABLE public.payroll_terms ADD COLUMN IF NOT EXISTS other_allowances jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(other_allowances)='array');

CREATE OR REPLACE FUNCTION public.payroll_save_profile(p_profile jsonb, p_term jsonb, p_actor_id uuid)
  RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE target uuid; existing public.payroll_profiles; linked_user uuid; profile_name text; prior_term public.payroll_terms; position_value bigint; other_values jsonb; item jsonb;
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
  SELECT * INTO prior_term FROM public.payroll_terms WHERE profile_id=target AND effective_from <= (p_term->>'effective_from')::date ORDER BY effective_from DESC LIMIT 1;
  position_value := COALESCE((p_term->>'position_allowance')::bigint,prior_term.position_allowance,0);
  other_values := CASE WHEN p_term ? 'other_allowances' THEN p_term->'other_allowances' ELSE COALESCE(prior_term.other_allowances,'[]'::jsonb) END;
  IF jsonb_typeof(other_values) IS DISTINCT FROM 'array' OR jsonb_array_length(other_values)>20 THEN RAISE EXCEPTION 'Invalid recurring allowances'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(other_values) LOOP
    IF jsonb_typeof(item->'label') IS DISTINCT FROM 'string' OR length(trim(item->>'label')) NOT BETWEEN 1 AND 160
      OR jsonb_typeof(item->'amount') IS DISTINCT FROM 'number' OR (item->>'amount') !~ '^[0-9]+$'
      OR (item->>'amount')::numeric > 1000000000000 THEN RAISE EXCEPTION 'Invalid recurring allowance'; END IF;
  END LOOP;
  INSERT INTO public.payroll_terms(profile_id,effective_from,contract,base_salary,position_allowance,other_allowances,updated_by)
    VALUES (target,(p_term->>'effective_from')::date,p_term->>'contract',(p_term->>'base_salary')::bigint,position_value,other_values,p_actor_id)
    ON CONFLICT(profile_id,effective_from) DO UPDATE SET contract=EXCLUDED.contract,base_salary=EXCLUDED.base_salary,position_allowance=EXCLUDED.position_allowance,other_allowances=EXCLUDED.other_allowances,updated_by=p_actor_id;
  RETURN target;
END;
$$;

REVOKE ALL ON FUNCTION public.payroll_save_profile(jsonb,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_save_profile(jsonb,jsonb,uuid) TO service_role;
