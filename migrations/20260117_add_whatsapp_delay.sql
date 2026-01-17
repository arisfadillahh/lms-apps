-- Add WhatsApp Delay Settings to invoice_settings table
ALTER TABLE invoice_settings
ADD COLUMN whatsapp_delay_min INTEGER NOT NULL DEFAULT 10,
ADD COLUMN whatsapp_delay_max INTEGER NOT NULL DEFAULT 30;

-- Comment on columns
COMMENT ON COLUMN invoice_settings.whatsapp_delay_min IS 'Minimum delay in seconds between WhatsApp messages';
COMMENT ON COLUMN invoice_settings.whatsapp_delay_max IS 'Maximum delay in seconds between WhatsApp messages';
