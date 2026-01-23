ALTER TABLE public.invoice_settings
ADD COLUMN seasonal_invoice_message_template text DEFAULT 'Halo Kak {student_name},

Berikut invoice untuk pembayaran program *{program_name}*:

📋 Invoice: {invoice_number}
🔗 Link: {invoice_url}

Mohon dilakukan pembayaran sebelum jatuh tempo. Terima kasih!';
