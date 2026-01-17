-- Update invoice message template with new format
UPDATE public.invoice_settings
SET invoice_message_template = 'Yth. Bpk/Ibu *{parent_name}*,

Tagihan kursus bulan *{period_month_year}*

━━━━━━━━━━━━━━━━━━
👦 Siswa:
{student_list}

💰 Total Tagihan: *Rp {total_amount}*
📅 Jatuh Tempo: *{due_date}*
━━━━━━━━━━━━━━━━━━

📄 Lihat invoice lengkap:
{invoice_url}

Setelah transfer, mohon konfirmasi dengan mengirim bukti ke nomor ini.

Terima kasih 🙏
*CLEVIO Coder Team*',
updated_at = now();
