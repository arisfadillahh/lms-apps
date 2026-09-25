# Webhook report masalah LMS

Alur: tombol `IssueReportButton` mengirim `POST /api/issue-reports` sebagai `FormData`. Route menyimpan report pada `issue_reports`, mengunggah screenshot ke bucket `STORAGE_BUCKET_REPORTS`, dan membuat notifikasi admin. Setelah respons `201`, `after()` mengirim pesan atau gambar melalui `sendWhatsAppMessage` / `sendWhatsAppImage` dan secara paralel mengirim JSON ke webhook Programmer Clevio.

Atur environment server berikut, lalu restart aplikasi:

```text
LMS_REPORT_WEBHOOK_URL=<URL webhook dari panel Cursor>
LMS_REPORT_WEBHOOK_SECRET=<key webhook dari panel Cursor>
```

Simpan kedua nilai hanya di env server (untuk pengembangan lokal, `.env.local` diabaikan Git). URL kosong berarti webhook dilewati dan dicatat ringkas di log. Secret dikirim sebagai `Authorization: Bearer <key>` sesuai [panduan Cursor Routines](https://cursor.com/help/grok-bot/routines). Nilai env yang sudah memuat `Bearer ` atau `Authorization: Bearer ` juga diterima. Secret tidak masuk payload. Isi kedua env di VPS saat deploy dan restart aplikasi; jangan commit nilainya.

Contoh payload:

```json
{
  "event": "lms_report",
  "report_id": "a1b2c3d4-1111-2222-3333-444455556666",
  "title": "Tombol simpan tidak merespons",
  "description": "Terjadi setelah melengkapi seluruh penilaian.",
  "reporter": { "id": "user-uuid", "name": "Coach Test", "role": "COACH" },
  "page_url": "/coach/rubrics/example",
  "user_agent": "Browser/device user agent",
  "viewport": { "width": 1280, "height": 720 },
  "screenshot": {
    "url": "https://storage.example/signed-url",
    "storage_path": "issue-reports/2026-09/a1b2c3d4-1111-2222-3333-444455556666.png",
    "note": "Signed URL expires after 1 hour."
  },
  "timestamp": "2026-09-25T00:00:00.000Z"
}
```

Bot perlu mengambil screenshot dari signed URL sebelum satu jam berlalu. Jika unggahan screenshot gagal, `url` dan `storage_path` bernilai `null`, sementara `note` menjelaskan bahwa gambar hanya dapat tiba lewat WhatsApp. Jika tidak ada screenshot, seluruh nilai dalam `screenshot` bernilai `null`. Metadata kelas tidak ada pada form report saat ini; halaman terkait tersedia melalui `page_url` bila pelapor mengisinya.

Pengiriman webhook dibatasi lima detik. Kegagalannya dicatat dengan ID report dan status HTTP atau pesan error, tanpa membatalkan report atau pengiriman WhatsApp. Jika WhatsApp gagal, `whatsapp_status` menjadi `FAILED`, `whatsapp_error` menyimpan alasannya, dan webhook tetap dicoba. Endpoint belum melakukan retry otomatis; ID report dapat dipakai penerima untuk deduplikasi bila pengiriman diulang secara operasional.

Untuk uji manual, gunakan report asli yang memang perlu ditindaklanjuti dari UI setelah env deploy terpasang, lalu cek Run history routine dan log `[IssueReportWebhook]`. Jangan kirim report sintetis ke URL routine aktif karena POST yang diterima langsung memulai run.
