-- Supabase grants ALL to service_role on new public tables by default.
-- GRANT SELECT/INSERT alone does not remove inherited UPDATE/DELETE/TRUNCATE.
-- Re-establish the intended payroll boundary without changing data or RLS.
REVOKE ALL ON public.payroll_profiles, public.payroll_terms,
  public.payroll_rate_cards, public.payroll_settings, public.payroll_periods,
  public.payroll_audit, public.payroll_activity_requests
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.payroll_profiles, public.payroll_terms,
  public.payroll_rate_cards, public.payroll_settings, public.payroll_periods
  TO service_role;
GRANT SELECT, INSERT ON public.payroll_audit, public.payroll_activity_requests
  TO service_role;

REVOKE ALL ON SEQUENCE public.payroll_audit_id_seq
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.payroll_audit_id_seq TO service_role;
