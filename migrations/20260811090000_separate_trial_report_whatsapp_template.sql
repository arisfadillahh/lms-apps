-- Keep weekly report and trial report WhatsApp messages independently editable.
BEGIN;

ALTER TABLE public.whatsapp_templates
  DROP CONSTRAINT IF EXISTS valid_whatsapp_template_category;

ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT valid_whatsapp_template_category
  CHECK (category IN ('PARENT_ABSENT', 'REPORT_SEND', 'TRIAL_REPORT_SEND', 'REMINDER'));

INSERT INTO public.whatsapp_templates (category, template_content, variables)
SELECT
  'TRIAL_REPORT_SEND',
  COALESCE(
    (SELECT variables->'trial'->>'content'
     FROM public.whatsapp_templates
     WHERE category = 'REPORT_SEND'
       AND jsonb_typeof(variables) = 'object'
       AND variables ? 'trial'),
    'Halo Ayah/Bunda {parent_name},\n\nLaporan hasil Free Trial Class untuk *{nama_siswa}* sudah tersedia.\n\n{rekomendasi_program}\n\nSilakan buka report trial untuk melihat rangkuman dan rekomendasi Coach:\n{link_raport}\n\nTerima kasih.\n*Clevio Coder Camp*'
  ),
  COALESCE(
    (SELECT variables->'trial'->'variables'
     FROM public.whatsapp_templates
     WHERE category = 'REPORT_SEND'
       AND jsonb_typeof(variables) = 'object'
       AND variables ? 'trial'),
    '["parent_name", "nama_siswa", "jenis_laporan", "rekomendasi_program", "link_raport"]'::jsonb
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates WHERE category = 'TRIAL_REPORT_SEND'
)
ON CONFLICT (category) DO NOTHING;

-- If the compatibility fallback was used before this migration, restore the
-- weekly variables column to its original array shape after copying trial data.
UPDATE public.whatsapp_templates
SET variables = variables->'weekly'
WHERE category = 'REPORT_SEND'
  AND jsonb_typeof(variables) = 'object'
  AND variables ? 'weekly';

COMMIT;
