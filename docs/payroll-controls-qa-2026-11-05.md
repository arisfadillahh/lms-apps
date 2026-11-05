# QA penggajian — keputusan tim, 5 November 2026

Status: local saja, branch `codex/mac-aris-coach-payroll`. Tidak ada deploy, migrasi production, perubahan VPS/n8n, atau pengiriman WhatsApp/Telegram nyata. Database demo lama dipertahankan tanpa reset.

## Hasil implementasi

| Keputusan | Hasil |
| --- | --- |
| Koreksi harus bisa dipantau | Pengajuan tersimpan per periode, PIC, status Menunggu/Diproses/Selesai/Ditolak, tanggapan coach, audit per perubahan. Koreksi yang belum selesai menghalangi finalisasi. |
| Deadline coach 25 pukul 17.00, aktivitas sampai 23.59.59 | Deadline API/UI/pesan tetap tegas tanpa menawarkan pengecualian. Periode aktivitas tidak dipotong pukul 17.00. Admin dapat mengoreksi sumber atau menambah aktivitas manual berkategori dan beralasan. |
| Akun finance | Akun lokal `finance.demo`, izin menu payroll, identitas audit tersendiri. Login password biasa dan akses API diuji. |
| Salah menandai transfer | Pembatalan beralasan terpisah dari transfer asli. Riwayat final dan transfer tetap utuh. Status dibayar, akses PDF coach, dan izin kirim mengikuti transfer yang belum dibatalkan. Tidak melakukan operasi bank. |
| Trial goal dari invoice | Konfirmasi invoice trial lunas memicu sinkronisasi payroll; callback berulang memakai tanggal pembayaran asli. Bonus tetap satu kali per anak menurut aturan sumber yang sudah ada. Kegagalan payroll tidak membatalkan pembayaran. |
| Satu trial dengan beberapa anak | Satu penilaian valid mencatat satu sesi. Laporan anak lain yang belum lengkap menghasilkan peringatan untuk admin; lengkapi atau catat pemeriksaan beralasan. |
| Prorata / penyesuaian bulan selanjutnya | Memakai tambahan/potongan berlabel dan beralasan pada periode yang dipilih. Tidak ada prorata otomatis, cicilan, penarikan uang, atau perpindahan saldo otomatis. |
| Coach tanpa nominal | Halaman/API rekap hanya memuat aktivitas dan status koreksi. Tidak mengirim rate, amount, total, terms, transfer, atau riwayat slip mentah. Nominal hanya melalui slip final setelah pembayaran. |
| Uji paralel n8n | Sumber Sheet dibaca lewat konektor: snapshot privat 18 coach, 41 jadwal, serta izin. Panel pembanding lokal mempertahankan hitungan dan estimasi sumber. Tidak membuat transaksi gaji atau notifikasi dari snapshot. |

## Verifikasi

- Seluruh suite termasuk empat tes hook invoice: **744 tes / 131 file lulus**.
- Suite payroll dan hook invoice sesudah perubahan terakhir: **98 tes / 12 file lulus**, termasuk empat tes pembayaran baru.
- Setelah menambah satu regresi trial multi-anak, `payrollSources.spec.ts` kembali lulus **15 tes**: satu penilaian mencatat satu sesi, laporan anak lain memunculkan peringatan, pemeriksaan PIC beralasan menyelesaikan peringatan.
- TypeScript dan build default Turbopack dengan kredensial dummy lokal: lulus. Build tanpa variabel lingkungan gagal karena `NEXTAUTH_SECRET` wajib; tidak menggunakan kredensial production untuk mengatasinya.
- Build tambahan `--webpack` menemukan masalah CSS lama pada `PublicPortfolioExperience.module.css` (selector global tidak pure). File portfolio tidak diubah. Build default repo lulus.
- ESLint pada 25 file berubah/baru selain `trialConversion.ts`: **0 error, 0 warning**. Enam `no-explicit-any` pada `trialConversion.ts` sudah ada di HEAD, tidak ditambah perubahan ini. Lint global repo masih gagal pada masalah lama (685 error, 271 warning pada saat pemeriksaan).
- PostgreSQL/PGlite: migrasi additive berhasil; pembatalan transfer immutable, penanda ganda/referensi tidak sah ditolak; RLS dan konflik revision tetap diuji.
- `node scripts/qa-payroll-controls-local.mjs`: lima kelompok uji API dan UI lulus. Finance/coach/PIC, keputusan koreksi, nominal tersembunyi, manual Weekly offline dua anak, pembatalan/penandaan ulang transfer, penolakan PDF, deadline, desktop dan mobile.
- Login normal `finance.demo` memakai password lokal berhasil tanpa shortcut cookie preview.
- Screenshot desktop 1440×1000 dan mobile 390×844 diperiksa; tidak ada overflow halaman atau exception browser. Hasil privat di `.codex-payroll-local/qa-controls/`.
- WA simulasi dan otomatisasi tetap nonaktif. QA tidak mengirim pesan nyata; aktivitas manual uji dihapus kembali. Audit dan pengajuan QA selesai tetap tersimpan sebagai riwayat simulasi.

## Batas pengujian / persiapan sebelum aktivasi

1. Snapshot n8n bukan sinkronisasi live atau impor pembayaran. Sumber kumulatif tidak menyediakan tanggal tiap sesi. Identitas coach, kelas, kontrak dan sumber aktivitas nyata harus dicocokkan, lalu diambil snapshot baru pada awal paralel operasional. Tidak ada pencocokan akun nyata ke akun demo secara otomatis.
2. Sistem lama tetap patokan bulan ini. Target migrasi bulan berikutnya belum mengaktifkan apa pun. Penghentian/alih notifikasi lama dan aktivasi cron LMS membutuhkan instruksi deploy terpisah.
3. Perangkat WA nyata, penerimaan PDF di ponsel, dan proses transfer bank belum diuji pada production karena belum diizinkan. File slip yang telanjur diterima tidak dapat ditarik dari perangkat, walaupun akses unduh berikutnya dapat ditutup.
4. Jadwal recap 25/09.00, pengingat 16.00, penutupan koreksi 17.00, dan pergantian periode 26 diuji dengan waktu deterministik; tidak menunggu tanggal nyata.

Panduan pemakaian dan flowchart coach/admin/finance: [payroll-user-guide.md](./payroll-user-guide.md).
