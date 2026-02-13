-- Migration to fix absence notification database issues
-- 1. Add missing column to invoice_settings
ALTER TABLE public.invoice_settings 
ADD COLUMN IF NOT EXISTS enable_absent_notification BOOLEAN DEFAULT true;

-- 2. Setup RLS for whatsapp_templates
-- Enable RLS (if not already enabled)
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors on rerun
DROP POLICY IF EXISTS "Admins can do everything with templates" ON public.whatsapp_templates;

-- Create policy to allow Admins (service role or proper user) to manage templates
-- If getSupabaseAdmin() is working correctly with service role, it bypasses this.
-- If not, this policy will allow users with 'ADMIN' role to manage it if we use anon client.
-- But since we use getSupabaseAdmin, we'll just ensure policies don't block the role we need.
CREATE POLICY "Admins can do everything with templates" 
ON public.whatsapp_templates
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'ADMIN'
  )
);

-- Also add a policy for the service role just in case (though it should bypass anyway)
-- Supabase automatically allows service_role, but explicit policies can sometimes help if things are weird.
CREATE POLICY "Service role bypass"
ON public.whatsapp_templates
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
