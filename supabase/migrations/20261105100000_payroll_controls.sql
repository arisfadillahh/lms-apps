-- Append-only reversals preserve the original transfer and the immutable final slip.
CREATE OR REPLACE FUNCTION public.payroll_reversal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE entry jsonb; candidate jsonb;
BEGIN
  IF jsonb_typeof(COALESCE(NEW.document->'transfer_reversals', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Transfer reversals must be an array';
  END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(COALESCE(OLD.document->'transfer_reversals', '[]'::jsonb)) LOOP
    SELECT value INTO candidate FROM jsonb_array_elements(COALESCE(NEW.document->'transfer_reversals', '[]'::jsonb)) WHERE value->>'id' = entry->>'id';
    IF candidate IS DISTINCT FROM entry THEN RAISE EXCEPTION 'Transfer reversal history is immutable'; END IF;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.document->'transfer_reversals', '[]'::jsonb)) LOOP
    IF length(trim(COALESCE(entry->>'reason',''))) < 5 OR COALESCE(entry->>'by','') = ''
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.document->'transfers') t WHERE t->>'id' = entry->>'transfer_id') THEN
      RAISE EXCEPTION 'Invalid transfer reversal';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(NEW.document->'transfer_reversals') r WHERE r->>'id' = entry->>'id' OR r->>'transfer_id' = entry->>'transfer_id') <> 1 THEN
      RAISE EXCEPTION 'Duplicate transfer reversal';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS payroll_period_reversal_history ON public.payroll_periods;
CREATE TRIGGER payroll_period_reversal_history BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION public.payroll_reversal_guard();
REVOKE ALL ON FUNCTION public.payroll_reversal_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payroll_reversal_guard() TO service_role;
