# Rekap payroll dari sistem lama

Rekap hasil impor dibuka melalui **Gaji & Slip Gaji → Rekap & arsip → Rekap sistem lama**. Pilih bulan/tahun untuk melihat arsip, cari nama coach, lalu klik **Rincian** untuk melihat seluruh hitungan dan fee sumber dalam popup.

Sistem lama tetap menjadi patokan selama November 2026. Rekap impor adalah salinan pada waktu pengambilan yang tercantum di layar, bukan sinkronisasi langsung. Menghitung ulang rekap LMS tidak menambah counter lama ke sesi LMS dan tidak mengganti salinan sumber. Otomasi payroll/WA tetap nonaktif selama impor.

## Cakupan dan interpretasi

- Folder n8n **Rekap Gaji Mitra** menyediakan arsip November 2025–Oktober 2026. Sumber aktif menyediakan November 2026: total 13 periode dan 15 salinan.
- Desember 2025 memiliki tiga salinan. Pilih **Versi arsip sumber** untuk membandingkan; salinan penutupan tanggal 25 menjadi tampilan awal. Versi alternatif tidak dijumlahkan.
- Semua counter serta fee sumber, termasuk transport dan fee join coder pada arsip lama, dipertahankan. Tarif LMS saat ini tidak diterapkan ulang ke riwayat.
- Beberapa arsip awal tidak memiliki kolom total atau memiliki total kosong. Untuk baris tersebut aplikasi menjumlahkan fee yang terisi dan memberi label **Jumlah fee terisi**. Fee yang kosong tetap tampil **Kosong di sumber**.
- Sumber lama berisi hitungan kumulatif, sehingga impor tidak membuat tanggal sesi, status kontrak, atau bukti transfer. Impor juga tidak membuat akun/profil kontrak coach berdasarkan kemiripan nama.
- Kolom AA Agustus 2026 tidak berjudul dan memuat empat rumus `Z - 25000`, sementara Total Estimasi menjumlahkan O:Y. Sesuai arahan pengguna, catatan manual tanpa judul ini diabaikan; total utama Agustus tetap mengikuti Z. Data mentah tetap tersimpan privat.
- **Rekap LMS** tetap merupakan perhitungan operasional LMS tersendiri. Sebelum migrasi penuh, PIC perlu mengonfirmasi pemetaan identitas, kontrak, serta sumber aktivitas, lalu mencocokkan hasilnya dengan rekap lama.
- Hanya admin/finance dengan izin payroll dapat membaca nominal impor. Respons coach dan coach lead tetap memakai daftar field operasional yang diizinkan dan tidak menyertakan arsip finansial.

## Prosedur operator

Gunakan source Google Sheets yang diambil read-only, dengan metadata file dan CellData termasuk nilai efektif serta formula. File data dan backup tidak boleh masuk Git. Script berjalan dengan Node 24.22+ dan secara default hanya melakukan dry run:

```sh
node scripts/import-payroll-legacy.mjs --input /private/source-archives.json.gz --current-period 2026-11 --ignore-unlabelled-extras
```

Setelah verifikasi, jalankan dari release production yang sudah disetujui:

```sh
node scripts/import-payroll-legacy.mjs --input /private/source-archives.json.gz --current-period 2026-11 --ignore-unlabelled-extras --apply --env /root/lms/shared/.env --backup-dir /root/lms/deploy-backups/payroll-import
```

Impor menolak otomasi yang aktif, struktur/angka tidak valid, ID duplikat, atau total yang tidak cocok dengan komponen sumber. Backup periode awal dibuat privat sebelum perubahan. Setiap periode memakai RPC compare-and-swap dan audit `IMPORT_N8N_ARCHIVE`; pekerjaan bisa dilanjutkan setelah kegagalan tanpa menambahkan salinan yang sama lagi. Ulangi input identik untuk memverifikasi status `UNCHANGED`.

Data berada pada `payroll_periods.document.legacy_imports`, menggunakan kontrol akses dan audit periode yang sudah ada; tidak membutuhkan migration tabel baru. Importer mempertahankan seluruh field periode lain, termasuk PIC, koreksi, slip, transfer, aktivitas, dan riwayat final. Pengiriman serta transfer tidak dipanggil. Data mentah/cadangan perlu disimpan untuk penelusuran atau pemulihan melalui revisi beralasan.

## Verifikasi

Test regresi mencakup jumlah komponen, formula error, identitas/period mismatch, fee kosong, teks rupiah, versi arsip ganda, impor berulang, perhitungan LMS tanpa hitung ganda, dan pembatasan nominal coach/coach lead. QA browser lokal mencakup login finance, tabel 18 coach, popup rincian, filter periode, pergantian tiga versi Desember, pengabaian kolom manual Agustus, serta tampilan desktop/HP. Fixture browser tidak menulis database lokal.

Pemeriksaan production setelah impor harus mencocokkan setiap coach, counter, fee, total, checksum, dan jumlah versi; memastikan field periode lama tidak berubah, ulang impor menghasilkan `UNCHANGED`, dan otomasi tetap nonaktif. Tidak menguji pengiriman WA atau transaksi bank nyata.
