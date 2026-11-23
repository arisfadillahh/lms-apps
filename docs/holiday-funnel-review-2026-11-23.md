# Review perbaikan funnel Holiday Class

Status: branch `codex/holiday-funnel`, belum merge, deploy, migrasi production, atau kirim WhatsApp sungguhan. Harga, batch, kuota, dan alur invoice bulanan dipertahankan.

## Alur orang tua

1. Pilih jenjang, program dan batch. Jadwal bentrok tidak bisa dipilih; server tetap memvalidasinya.
2. Isi nama orang tua, nama anak dan WhatsApp. Email tidak diminta.
3. Pesanan identik dalam 24 jam membuka pilihan lanjut ke invoice sebelumnya atau mengubah pilihan kelas. Program/batch berbeda tetap dapat menjadi pesanan tambahan.
4. Invoice Holiday menampilkan program, tanggal, jam WIB dan rincian total. Biaya admin terlihat sebelum memilih metode.
5. BNI VA, BRI VA dan QRIS mudah ditemukan; bank lain ada di bagian tersendiri. Metode yang belum aktif tetap tidak dibuka. QR dapat disimpan; QR kedaluwarsa bisa dibuat ulang tanpa mengulang pendaftaran.
6. Setelah pembayaran terverifikasi dari penyedia, invoice menjadi lunas dan konfirmasi WhatsApp masuk antrean. Pengukuran Purchase disimpan secara atomik dengan perubahan status lunas.

## Tahap perubahan

| Area | File utama | Hasil |
| --- | --- | --- |
| Reliabilitas pesanan/WA | `holidayClassRegistration.ts`, `holidayClassMessaging.ts`, migration `20261123090000_holiday_funnel.sql` | Dedup atomik lintas UUID, alasan gagal yang disamarkan, retry lama dipertahankan, pengingat opt-in |
| Follow-up CS | `/api/admin/holiday-class/follow-up` | Pagination, akses admin dengan izin invoice, hanya empat digit akhir nomor dan status WA orang tua terakhir |
| Pengukuran | `holidayMetaConversions.ts`, `holidayAttribution.ts`, migration `20261123093000_holiday_meta_outbox.sql` | Outbox durable, ID browser/server sama, Purchase idempoten, retry dan peringatan konfigurasi kosong |
| Browser Pixel | `metaPixel.ts`, `holidayBrowserMeasurement.ts`, `/holiday-measurement`, CSP | Runtime-ready delivery; kode pihak ketiga terisolasi dari dokumen invoice bertoken dalam iframe sandbox tanpa same-origin dan tanpa referrer |
| Invoice Holiday | `HolidayInvoiceView.tsx`, CSS module, invoice `page.tsx` | Layout HP asli 360px, ringkasan pesanan, biaya, bantuan, status lunas dan QR/VA |
| Landing aktif | `ops/holiday-landing/` | Sumber container yang benar, script berversi baru, atribusi, pilihan pesanan duplikat dan copy perangkat |

Landing aktif dilayani container static terpisah. Mengubah halaman Next.js lama saja tidak akan mengubah `/holiday-class/`. Petunjuk publikasi terpisah dan hash baseline ada di `ops/holiday-landing/README.md`.

## Aturan pengingat

- `HOLIDAY_REMINDER_ENABLED` default nonaktif.
- H+1 dan H+3 dihitung dari waktu pembuatan, masing-masing sekali, dalam jam 09.00–19.59 WIB.
- Catch-up H+3 tidak sekaligus mengirim H+1. Pengingat H+1 tertunda tidak dikirim lagi jika tahap H+3 sudah ada.
- Status invoice dan masa berlaku diperiksa lagi sebelum pengiriman. Lunas, dibatalkan/dihapus, atau masa berlaku habis menghentikan pengingat.
- Default jatuh tempo tetap satu hari seperti sebelumnya. Dengan default itu, H+3 sengaja tidak dikirim setelah invoice kedaluwarsa. Bila ingin H+3 berjalan, tentukan masa berlaku yang sesuai sebelum mengaktifkan pengingat; tidak ada tanggal invoice lama yang diubah.
- Kegagalan WA dicatat dari hasil transport yang memang dipakai (Baileys); tidak mengarang HTTP gateway status/body yang tidak tersedia. Retry maksimal delapan percobaan dengan jeda tetap dipertahankan.

## Pengukuran

- CompleteRegistration memakai UUID pendaftaran canonical; bukan UUID permintaan duplikat.
- InitiateCheckout memakai `checkout:<nomor invoice>`, dengan total termasuk biaya admin.
- Purchase memakai nomor invoice dan gross terverifikasi. Webhook berulang tidak menambah event baru.
- Nomor WA dinormalisasi ke 62 lalu SHA-256. `_fbp`, `_fbc`, UTM, fbclid, user-agent dan IP dari reverse proxy disertakan ketika tersedia. Tidak menambah permintaan email.
- Transaksi pendaftaran/penyimpanan instruksi pembayaran mengantrekan event di database. Tidak bergantung pada browser menyelesaikan navigasi atau API Meta sedang tersedia.
- Token kosong menghasilkan warning dan event tetap antre. Error Meta disimpan sebagai status/code, tanpa token atau raw respons sensitif.
- Percobaan ulang Meta maksimal 12, dengan lease untuk mencegah worker bersamaan mengklaim event yang sama.
- Histori lama tanpa persetujuan/pengukuran yang tercatat tidak diubah atau dikirimi event rekaan.

## Verifikasi

- 38 tes fokus Holiday, termasuk SQL/PGlite, dedup, webhook, Purchase atomik, H+1/H+3, invoice lunas/kedaluwarsa, error/retry, RLS, penghapusan dummy dan Pixel runtime: lolos.
- TypeScript dan lint pada layanan/UI baru serta file pendukung yang diperiksa: lolos. Syntax check JS landing dan whitespace diff: lolos.
- Build production lokal: lolos setelah mengulang peringatan dependency Next.js; dependency tidak diubah.
- Suite penuh: 1.096 lolos dan dua gagal yang sama pada baseline `fc93c86`. Keduanya direproduksi di checkout terpisah: `coachMobileHeader.contract.spec.ts` dan `coachStudentAttendanceFlow.spec.ts`. Area tersebut tidak diubah di branch ini.
- Browser invoice: 360px/1280px tanpa overflow, viewport bulanan tetap, CSP Holiday terpisah, VA, QR expired/regenerate, paid state, dan sandbox Pixel tanpa token: lolos, tanpa page error.
- Lighthouse mobile accessibility: **100** pada invoice uji.
- Browser formulir static: event canonical sebelum redirect, atribusi UTM/fbclid, tanpa email, pilihan invoice duplikat, dan opsi batch bentrok nonaktif: diuji dengan stub lokal.
- Screenshot dari komponen invoice baseline dan hasil baru tersedia di `.data/qa/holiday-funnel/`, menggunakan data sintetis. Tidak mengambil data peserta asli. `report.json` dan `lighthouse.json` ada di folder yang sama.

## Batas verifikasi dan risiko sebelum rilis

Belum ada uji nyata Midtrans Sandbox atau Meta Test Events. Pengujian gateway dan Pixel menggunakan mock/stub, sehingga belum membuktikan aktivasi metode merchant, penerimaan Meta, atau kecocokan perangkat dengan script Meta sungguhan. Tidak ada transaksi production atau pesan WA uji.

Next.js 16.4.2 memunculkan peringatan keamanan. Audit npm menunjukkan advisory tingkat moderate pada dependency tersebut dan patch 16.4.6 tersedia. Ini perlu ditangani terpisah sebelum menyebut keseluruhan aplikasi bersih dari temuan; versi dependency tidak dinaikkan diam-diam dalam scope Holiday.

## Konfigurasi untuk persiapan rilis

Nama saja; tidak ada nilai konfigurasi server yang diubah:

- `META_CONVERSIONS_API_TOKEN`
- `NEXT_PUBLIC_META_PIXEL_ID` (sudah digunakan sebelumnya)
- `META_TEST_EVENT_CODE` (opsional untuk pengujian)
- `HOLIDAY_REMINDER_ENABLED` (default false)
- `HOLIDAY_INVOICE_DUE_DAYS` (default 1; rentang 1–30, paling lambat tanggal mulai kelas)
- `HOLIDAY_CS_WHATSAPP` (fallback ke kontak admin invoice yang sudah ada)

Urutan rilis setelah persetujuan: review migration → terapkan dua migration secara berurutan → deploy backend/UI LMS → publikasi sumber landing static → verifikasi Sandbox/Test Events → baru pertimbangkan aktivasi pengingat. Migration hanya menambah kolom nullable/tabel antrean serta fungsi/trigger; tidak mengubah atau menghapus invoice/registrasi yang sudah ada. RLS dan akses antrean tetap server-only.

## Menjalankan QA lokal

Gunakan runtime Node proyek. `scripts/qa-holiday-funnel.mjs` menjalankan build yang sudah tersedia dengan API Supabase sintetis, payment instructions stub dan Pixel stub. `QA_LIGHTHOUSE=true` menambahkan audit accessibility. `scripts/qa-holiday-landing.mjs` menguji formulir static asli dengan API lokal. Keduanya berhenti dan menutup server setelah selesai; tidak menjalankan pengiriman nyata.
