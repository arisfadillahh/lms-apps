-- Repair missing operational permissions for the existing Coach Lead account.
-- Preserve all existing menus; do not grant payroll/financial access.
BEGIN;
UPDATE public.users
SET admin_permissions = jsonb_set(admin_permissions::jsonb, '{menus}', (
  SELECT jsonb_agg(menu ORDER BY menu)
  FROM (
    SELECT DISTINCT jsonb_array_elements_text(
      COALESCE(admin_permissions::jsonb->'menus', '[]'::jsonb)
      || '["coachAttendance","trialAssessments"]'::jsonb
    ) AS menu
  ) AS allowed
))
WHERE username = 'coachlead' AND role = 'ADMIN' AND is_active = true
  AND admin_permissions IS NOT NULL
  AND NOT COALESCE((admin_permissions::jsonb->>'is_superadmin')::boolean, false);
COMMIT;
