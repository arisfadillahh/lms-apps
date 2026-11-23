# Laporan lanjutan Holiday funnel — 23 November 2026

Branch tetap `codex/holiday-funnel`. Lima bagian dipisahkan menjadi lima commit; security patch berada paling akhir. Tidak merge, deploy, menjalankan migration production, mengirim WhatsApp sungguhan, maupun menulis konfigurasi/secret server. QA memakai data sintetis dan konfigurasi proses lokal, tanpa file `.env` baru. Perubahan dokumen lokal yang sudah ada sebelum pekerjaan ini tidak disertakan.

## Bagian 1 — QRIS dan pesan pendaftaran

File: `src/lib/holidayPaymentOptions.ts`, `HolidayInvoiceView.tsx`, CSS module dan invoice `page.tsx`, `holidayClassMessaging.ts`, `holidayPaymentOptions.spec.ts`, `scripts/qa-holiday-funnel.mjs`.

- QRIS urutan pertama dan terpilih, lalu BNI VA, BRI VA; Bank lain tertutup sampai dibuka. QR diperbesar, ada Simpan QR serta petunjuk pembayaran dari galeri. Regenerasi QR kedaluwarsa tetap bekerja.
- Pembuatan QRIS gagal: halaman tetap berfungsi, pesan jelas muncul dan BNI VA ditawarkan. Kegagalan memuat gambar QR juga membuka pilihan VA. Tidak otomatis membuat VA tanpa tindakan orang tua.
- Biaya admin tetap Rp2.500 dan terlihat sebelum metode dipilih. Pengujian memakai total Rp902.500 pada UI dan event InitiateCheckout.
- Sapaan WA dibuat ramah, menyebut nama anak, ajakan menyelesaikan konfirmasi dan batas jatuh tempo dari invoice. Tidak mengklaim kursi terbatas/direbut peserta lain: kuota memang tidak dibatasi, sehingga urgensi memakai tenggat nyata dan konfirmasi keikutsertaan. Tidak ada pesan yang dikirim dalam pengujian.
- **Batas e-wallet:** `HOLIDAY_GOPAY_ENABLED` dan `HOLIDAY_SHOPEEPAY_ENABLED` menjadi konfigurasi merchant yang diperiksa khusus Holiday, tetapi flag saja tidak membuka metode. Adapter deeplink yang bisa diverifikasi belum tersedia pada jalur Snap saat ini. Konfigurasi ditambah dengan guard kesiapan adapter; jika flag diaktifkan sebelum adapter tersedia, ada warning dan metode tetap tersembunyi. Jadi kebutuhan “langsung menyala begitu merchant aktif” belum selesai; membutuhkan implementasi/verifikasi adapter terpisah. Invoice bulanan tidak diubah.

Uji manual: buka invoice sintetis, lihat QRIS pertama dan biaya admin, paksa endpoint pembuatan QRIS gagal, lanjutkan BNI, lalu ulangi QRIS dengan instruksi kedaluwarsa dan buat QR baru. Baca pesan pendaftaran melalui unit/mock transport, bukan WA live.

## Bagian 2 — Default tiga hari dan pengingat kalender WIB

File: `holidayReminders.ts`, `holidayClassRegistration.ts`, migration baru `20261123110000_holiday_three_day_validity.sql`, `holidayFunnelRules.spec.ts`, `holidayFunnelDatabase.spec.ts`.

- Default invoice **baru** tiga hari; override 1–30 hari dan batas tanggal mulai kelas tetap berlaku. Tidak ada UPDATE invoice lama. Migration mengubah default fungsi pendaftaran dan fungsi pengantrean pengingat saja.
- H+1/H+3 berdasarkan selisih **tanggal WIB**, bukan menunggu tepat 24/72 jam. Pendaftaran pukul 23.59 WIB dapat diingatkan pukul 09.00 pada H+1 serta H+3.
- Pengiriman hanya 09.00–19.59 WIB. Berlaku sampai akhir tanggal jatuh tempo; setelahnya, lunas, dibatalkan/dihapus, atau tidak aktif: tidak dikirim. H+3 tidak menumpuk kiriman H+1 saat catch-up.
- Jadwal dicek di SQL/PGlite serta aturan murni. Pengingat tetap opt-in; tidak diaktifkan pada environment mana pun oleh pekerjaan ini.

Uji manual: siapkan invoice test dengan created_at menjelang tengah malam dan due_date H+3; jalankan enqueue memakai waktu sintetis sebelum 09.00, pukul 09.00 H+1, H+3, dan H+4. Verifikasi satu event per tahap, tidak ada event untuk invoice PAID/expired, dan due_date tidak berubah.

## Bagian 3 — Alat Sandbox dan Meta Test Events

File: `scripts/verify-holiday-sandbox.mjs`, `scripts/lib/holiday-sandbox-safety.mjs`, `holidaySandboxSafety.spec.ts`, `docs/holiday-funnel-release-checklist.md`.

- Tanpa konfigurasi: SKIPPED yang jelas, sebelum request atau penulisan DB. Tidak memuat `.env` otomatis.
- Kunci live/ambigu, flag production, dan URL database eksternal ditolak sebelum efek samping. Runner selalu memakai PGlite lokal, tidak pernah memakai Supabase production, serta tidak mengimpor transport WA.
- Mode `--mock` dan `--mock --resume` sudah dijalankan: dua invoice lokal, dua instruksi QRIS/VA sintetis, tiga jenis event per invoice, replay settlement idempoten dan `whatsappSent:0`.
- Bila konfigurasi Sandbox sungguhan tersedia, runner menerbitkan QRIS/BNI VA hanya pada host resmi Sandbox. Callback merchant dioverride ke sink non-production. Setelah operator membayar melalui simulator resmi, `--resume` membaca status provider, mensimulasikan notifikasi dan replay di DB lokal, kemudian mengirim CAPI dengan test_event_code. Instruksi/state disimpan tanpa key/token. Issuance ambigu tidak otomatis diulang.
- Status gateway PENDING bukan hasil lulus. Pembayaran simulator adalah langkah manual; script tidak merekayasa status sukses sebelum provider mengonfirmasi. Browser+server dedup juga tetap perlu diperiksa manual di Events Manager, terpisah dari HTTP accepted.
- **Belum diuji dengan key/token nyata** karena tidak disediakan/dimasukkan pada sesi ini. Tidak ada klaim bahwa Midtrans Sandbox atau Meta Test Events sungguhan sudah lulus.

Uji manual dan kriteria lulus lengkap ada di checklist rilis. Sandbox harus menghasilkan `complete:true` dan dua Purchase; Events Manager harus menunjukkan ID browser/server sama dan deduplicated, tanpa token invoice bocor ke Meta.

## Bagian 4 — Publikasi static terpisah

File: `ops/holiday-landing/README.md`, `scripts/verify-holiday-landing-hashes.mjs`, `holidayLandingHashes.spec.ts`, checklist rilis.

- Runbook mencakup pemeriksaan mount/script live, deteksi drift dari baseline, backup manifest, upload staging, instalasi script versi baru terlebih dahulu, atomic index switch, cek hash dan rollback.
- Pemeriksa hash hanya GET dan membaca file lokal. Mode candidate membandingkan index serta semua script aktif. Mode `--baseline` membandingkan hash baseline yang ditangkap sebelumnya. Mismatch keluar 2; gagal request keluar 1. Tidak melakukan SSH, upload, restart atau penulisan file.
- Pengujian response cocok, versi lama, 404 dan penolakan URL berisi kredensial/query lulus. Tidak mempublikasikan atau memeriksa live production secara otomatis pada sesi ini.
- Urutan rilis diperjelas: migration yang disetujui → deploy LMS → publikasi landing static → verifikasi hash dan alur. Deployment LMS sendiri tidak mempublikasikan container landing.

Uji manual: jalankan pemeriksa pada URL staging, ganti satu file staging untuk memastikan mismatch, lalu ikuti backup/rollback dan pastikan baseline pulih. Jangan mencoba langkah publikasi tanpa izin rilis.

## Bagian 5 — Next.js 16.4.6

File: `package.json`, `package-lock.json`, laporan ini. Versi Next.js dipin dari 16.4.2 ke 16.4.6. Lockfile hanya menaikkan Next.js, `@next/env` dan varian `@next/swc-*` yang harus mengikuti versi; tidak ada dependency lain yang naik atau dihapus. Audit npm setelah patch tidak lagi menemukan entri vulnerability `next`.

Suite penuh sebelum dan sesudah patch: **1.108 lolos, dua gagal** yang sama:

- `coachMobileHeader.contract.spec.ts`: kontrak class CSS header mobile lama.
- `coachStudentAttendanceFlow.spec.ts`: ekspektasi enrollment lama berbeda dari implementasi.

Tidak ada kegagalan tambahan atau perubahan perilaku pada skenario QA Holiday yang diperiksa, sehingga patch dipertahankan. Typecheck, lint perubahan dan build production lokal lulus. Build masih memberi warning tracing filesystem pada fungsi WhatsApp lama; fungsi itu tidak diubah atau dieksekusi oleh QA ini.

## Hasil gabungan dan artefak

| Pemeriksaan | Hasil |
| --- | --- |
| Tes fokus Holiday | 50/50, 12 file |
| Suite penuh pre/post security patch | 1.108 lolos, dua baseline gagal, identik |
| TypeScript | Lulus |
| ESLint file perubahan | Lulus |
| Build production lokal Next 16.4.6 | Lulus, warning tracing lama |
| QA invoice | QRIS pertama, fallback VA, VA/QR, regenerate expired, paid, CSP Holiday, monthly viewport tetap, tanpa overflow pada 360/1280px |
| QA landing static | Event canonical sebelum redirect, atribusi, tanpa email, pesanan duplikat dan batch bentrok: lulus |
| Lighthouse mobile accessibility | 100 |
| Sandbox mock, resume dan no-config skip | Lulus, WA 0 |
| Real Sandbox / Meta Test Events | Belum dijalankan; memerlukan konfigurasi operator |

Screenshot sesudah perubahan berada di `.data/qa/holiday-funnel/`:

- `holiday-invoice-360.png`, `holiday-invoice-1280.png`
- `holiday-qris-360.png`, `holiday-va-360.png`, `holiday-paid-360.png`
- `legacy-invoice-360.png`, `legacy-invoice-1280.png` (pembanding non-Holiday)
- `report.json`, `lighthouse.json`

Artefak sintetis tidak di-commit. Script runner: `QA_LIGHTHOUSE=true node scripts/qa-holiday-funnel.mjs` dan `node scripts/qa-holiday-landing.mjs`. Build yang dipakai adalah build lokal dengan API uji; tidak ada key/token pelanggan.

## Nama konfigurasi (tanpa nilai)

- `HOLIDAY_INVOICE_DUE_DAYS`
- `HOLIDAY_REMINDER_ENABLED`
- `HOLIDAY_CS_WHATSAPP`
- `HOLIDAY_GOPAY_ENABLED` / `HOLIDAY_SHOPEEPAY_ENABLED` (belum membuka metode tanpa adapter terverifikasi)
- `MIDTRANS_SANDBOX_SERVER_KEY` (runner menerima fallback MIDTRANS_SERVER_KEY hanya bila benar-benar prefix Sandbox)
- `META_CONVERSIONS_API_TOKEN`
- `META_TEST_EVENT_CODE`
- `NEXT_PUBLIC_META_PIXEL_ID`

Tidak ada konfigurasi di atas yang diisi pada environment production dalam sesi ini. Checklist rilis tetap wajib sebelum publikasi.
