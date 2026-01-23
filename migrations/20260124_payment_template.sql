ALTER TABLE public.invoice_settings
ADD COLUMN payment_confirmation_template text DEFAULT 'Yth. Bpk/Ibu {parent_name},

Pembayaran invoice {invoice_number} sebesar Rp {amount} telah kami terima.

Silakan unduh bukti pembayaran di:
{invoice_url}

Terima kasih atas pembayarannya.
CLEVIO Coder';
