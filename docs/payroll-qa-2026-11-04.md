# Laporan implementasi dan QA — 4 November 2026

## Status hasil

Fitur penggajian/absensi coach dan slip staf berjalan di **local**, pada task branch `codex/mac-aris-coach-payroll`, dari baseline production `a0cfd9a0b5ab552595f720ff8f9ffc471c05de48`. Tidak ada deploy, migrasi database production, perubahan n8n/VPS, transfer uang, atau pesan WA/Telegram sungguhan.

Preview: [pilih akun demo](http://127.0.0.1:4055). Jalankan ulang dengan `npm run dev:payroll-local` jika server berhenti. Data contoh dan status transfer dalam preview seluruhnya sintetis. WA ditandai **Simulasi local**, bukan Terkirim.

Panduan operasional: [payroll-user-guide.md](./payroll-user-guide.md). Temuan dan rancangan menu `/help` Telegram: [telegram-help-integration.md](./telegram-help-integration.md).

## Cakupan yang selesai

- Absensi kelas reguler otomatis memakai sesi, kepesertaan saat sesi, izin disetujui, serta coach pengganti. Pembatalan tidak dibayar; admin dapat memberi koreksi beralasan.
- Absensi trial otomatis setelah form penilaian dikirim oleh coach yang ditugaskan. Draft, jadwal lewat saja, atau penilaian coach lain tidak valid. Pencatatan absensi tidak melakukan pembayaran. Trial grup tetap satu fee per sesi; fulltime tanpa fee trial; bonus goal per anak tetap berlaku.
- Profil kontrak Mitra/Fulltime, gaji tetap, pilihan mode kelas/per sesi, tarif berdasarkan jenis kelas/cara belajar/jumlah anak, bonus goal awal Rp100.000 per anak dengan invoice lunas, dan perubahan tarif bertanggal.
- Coach mengajukan event, training, observasi online/offline; admin menyetujui/menolak dengan alasan dan mode fee. Pending/ditolak tidak masuk perhitungan. Observasi awal Rp25.000 online / Rp50.000 offline, dapat diubah admin.
- Periode 26–25 WIB, deadline reguler 25 pukul 17.00, seluruh malam tanggal 25 tetap periode berjalan, periode baru tanggal 26 tanpa menghapus arsip.
- Komponen manual transport/tunjangan/potongan, staf tanpa akun LMS, versi final, revisi admin, audit, transfer selisih, dan arsip/filter bulanan.
- Penanda transfer individual/massal, slip hanya setelah final dan transfer, kirim individual/checkbox massal, retry/status pengiriman, PDF slip privat, rekap teks WA tanpa nominal/lampiran, WA coach dari profil langsung, fallback notifikasi LMS.
- Tampilan admin memakai warna navy, font, border, radius, tombol, dan latar dashboard admin yang ada. Lebar mobile dibatasi; tabel digeser di dalam panel.

## Hasil verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| Seluruh Vitest | **712/712 lulus**, 126 file |
| Tes khusus payroll | **74 lulus**: model 23, sumber 14, database 8, delivery 9, permintaan aktivitas 6, cron 6, PDF/presentasi 4, sinkronisasi trial 3, izin notifikasi 1 |
| TypeScript | Lulus; juga dijalankan oleh build Next |
| ESLint modul payroll/API/UI | Lulus tanpa error/peringatan |
| Build resmi Next default/Turbopack | Lulus, 113 halaman statis diproses |
| Signed-out smoke pada hasil build | **7/7 lulus**: admin/coach page 307; admin/coach/activity/PDF/cron API 401 |
| CSP hasil build | Tidak mengandung unsafe-eval; izin eval hanya development |
| Browser desktop/mobile | **16 kelompok skenario lulus**, tanpa error JavaScript |
| PDF A4 | Slip arsip 1 halaman; slip staf panjang 4 halaman, semua 51 baris dan total lengkap |
| Git diff whitespace | Lulus |

Browser QA menggunakan aplikasi Next nyata dengan session akun demo dan PostgreSQL PGlite terisolasi melalui adapter REST local. Pengujian database menjalankan migrasi/RPC/trigger PostgreSQL, termasuk penolakan akses langsung, audit atomik, penolakan revisi kedaluwarsa, dan pelestarian snapshot/transfer.

## Skenario browser yang diuji

1. API dan cron menolak sesi kosong.
2. Coach/coder/admin tanpa izin payroll tidak dapat mengelola keuangan.
3. Admin memuat perhitungan dan tanggal dari database local.
4. Filter nama dan tata letak desktop.
5. Koreksi sesi melalui UI memindahkan penerima/mode/nominal dengan alasan.
6. Finalisasi ditolak selama periode berjalan.
7. Pengaturan mode kelas, kartu tarif goal/observasi awal, tab profil dan otomatisasi.
8. Staf tanpa akun, transport manual, penghapusan aktivitas, revisi browser kedaluwarsa, dan finalisasi.
9. Slip sebelum transfer ditolak; transfer berulang tidak ganda; bulk menghasilkan Simulasi WA/Hanya LMS/Tanpa Kontak sesuai penerima.
10. Revisi setelah deadline mempertahankan versi 1 dan transfer lama; hanya selisih Rp23.000 ditandai berikutnya.
11. PDF slip arsip dibuat melalui endpoint nyata; permintaan PDF rekap absensi ditolak (404).
12. Coach hanya menerima data sendiri; PDF coach lain 404; laporan koreksi melewati deadline ditolak.
13. Coach mengajukan event melalui UI; pending/ditolak tidak dibayar; admin menyetujui lewat UI; fee tercatat satu kali; duplikasi dan review kedaluwarsa ditolak.
14. Filter arsip dan layout admin/coach pada 390×844, termasuk pemeriksaan lebar konten di dalam shell yang menyembunyikan overflow.
15. Tidak ada error JavaScript browser.
16. Rekap massal memakai teks WA tanpa nominal/lampiran dan fallback LMS. Pesan notifikasi diperiksa memuat rincian kelas tanpa rupiah; unit test memastikan pembuat PDF/pengirim dokumen tidak dipanggil untuk rekap.

Tes sumber terpisah memverifikasi validasi penilaian trial, pengelompokan beberapa anak, penilaian terlambat setelah cutoff dengan tanggal sesi tetap, pembatalan, bonus goal hanya satu kali per anak, dan asal nomor WA. Tes sinkronisasi trial memverifikasi pembaruan rekap draft serta pemberitahuan kepada admin saat penilaian datang setelah periode final, tanpa mengubah slip final.

## Artefak dan cara mengulang

- `scripts/payroll-local.mjs` dan `scripts/payroll-local-schema.sql`: server preview + data sintetis. Bind hanya loopback.
- `scripts/qa-payroll-local.mjs`: QA browser; jalankan pada database demo awal setelah `npm run dev:payroll-local -- --reset`. QA ini membuat aktivitas, finalisasi, dan penanda transfer **di database demo**.
- `scripts/qa-payroll-pdf.py`: analisis/PNG PDF hasil QA. Memerlukan PyMuPDF pada runtime Python; pengujian ini memasangnya hanya dalam `.codex-payroll-local/python`.
- `.codex-payroll-local/qa/results.json`: daftar hasil browser; `pdf-results.json`: jumlah halaman dan batas teks.
- `.codex-payroll-local/qa/`: screenshot desktop/mobile, contoh pesan rekap tanpa nominal, slip arsip, slip multipage, dan render PNG untuk pemeriksaan visual. Folder ini diabaikan Git karena memuat data demo/artifact runtime.
- `supabase/migrations/20261104100000_payroll.sql`: migrasi yang sudah diuji pada database local; belum diterapkan ke Supabase production.

## Batas pemeriksaan dan tindak lanjut

Pengiriman WA nyata belum dijalankan karena preview local sengaja memakai simulasi. Jalur layanan WA diuji dengan mock sukses/gagal, deduplikasi, nomor grup ditolak, sumber nomor profil, fallback LMS, dan gating transfer. Sebelum aktivasi production, perlu uji integrasi WA dan migrasi pada lingkungan yang disetujui, pemilihan tanggal mulai, pencocokan rekap lama, serta cutover cabang n8n terkait. Langkah ini belum dilakukan.

Build resmi memakai Turbopack dan lulus. Percobaan alternatif `--webpack` menemukan selector global pada CSS portfolio yang sudah ada; berkas portfolio tidak diubah dalam pekerjaan ini. Build default masih memberi peringatan lama tentang React 18 dan tracing filesystem pada WhatsApp client. Perilaku sesi WA tidak diubah.

Request lesson, pusat dokumen SOP/Guidance, dan pemindahan administrasi di luar payroll baru dipetakan dalam rencana integrasi `/help`; bagian tersebut belum dipindahkan menjadi fitur LMS pada paket ini.
