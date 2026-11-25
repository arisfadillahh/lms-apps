# Sinkronisasi data payroll ke rekap LMS

Pengguna mengelola satu rekap melalui **Gaji & Slip Gaji → Rekap & arsip → Rekap penerima**. Data sinkronisasi menjadi komponen pada penerima dan periode yang sama. Tidak ada tab rekap pembanding. Popup Rincian menggabungkan aktivitas, jumlah dan nominal; komponen kosong tersembunyi sampai diminta, dan total terlihat di atas.

## Masa transisi

Sejak periode November 2026, **Perbarui rekap** dan cron menghitung dari data LMS. Salinan awal spreadsheet disimpan untuk arsip dan pembandingan dengan n8n. Saldo awal transport motor November dicatat sekali sebagai komponen LMS; trip baru berasal dari konfirmasi sesi offline di LMS. Workflow n8n berjalan terpisah.

Arsip November 2025–Oktober 2026 memakai satu salinan penutupan per bulan; alternatif Desember 2025 tetap disimpan sebagai bukti internal dan tidak dijumlahkan. Nominal historis tidak dihitung ulang memakai tarif atau gaji pokok terbaru. Jumlah dan fee kumulatif ditampilkan sebagai rekap bulanan tanpa membuat tanggal sesi fiktif. Kolom manual tanpa judul Agustus tetap diabaikan sesuai keputusan pengguna.

## Integritas dan akses

- Identitas dipasangkan dengan ID yang telah dikonfirmasi. Dua identitas Naufal menuju satu penerima. Identitas yang dikecualikan tetap ada dalam bukti mentah dan tidak masuk daftar penerima.
- Tarif sumber dan jumlah aktivitas dipertahankan. Komponen yang belum memiliki nominal tidak dianggap sebagai nilai yang telah disetujui; admin dapat mengoreksi dengan alasan.
- Gaji pokok/tunjangan rutin diterapkan satu kali pada periode berjalan. Gaji pokok fulltime yang belum diatur tetap menghalangi finalisasi. Gaji pokok sekarang tidak disisipkan ke arsip lama.
- Sinkronisasi tidak membuat penanda transfer, mengirim pesan atau mengganti versi final. Periode final harus dibuka melalui revisi beralasan sebelum data diperbarui.
- Coach dan coach lead hanya menerima aktivitas dan jumlah melalui proyeksi yang diizinkan, tanpa nominal atau detail koneksi sumber.

## Operasional teknis

`legacy_imports` dan `legacy_links` tetap menjadi bukti internal pada dokumen periode. `calculateSynchronizedPeriod` mengubah bukti tersebut menjadi slip/komponen rekap LMS yang sama dengan alur pembayaran. Perhitungan dari snapshot hanya dipakai untuk arsip sebelum November 2026. Aktivitas/manual yang ditambahkan operator tetap terpisah sebagai koreksi eksplisit pada rekap yang sama.

`node scripts/unify-payroll-periods.mjs --env /private/.env` melakukan dry-run seluruh arsip. Tambahkan `--apply --backup-dir /private/backups` untuk menyimpan backup dan melakukan pembaruan dengan pemeriksaan revisi serta audit. `--period YYYY-MM` membatasi satu periode. Profil, kontrak, kontak, transfer dan riwayat final tidak ditimpa.

`scripts/sync-payroll-source.py --config /private/source-config.json --env /private/.env` memeriksa akses sumber secara read-only. `--apply` menyimpan salinan mentah privat, memperbarui bukti sumber dan menghitung ulang satu rekap LMS. Kredensial dibaca di tempat tanpa ditulis ulang. Ini alat impor operator. Tombol Perbarui rekap dan cron tidak memanggilnya. Flag internal `--current-sync` pada importer/unifier hanya mengizinkan satu periode berjalan ketika pengiriman aktif, mempertahankan pengaturan, CAS, riwayat dan guard pengiriman berlangsung. Impor arsip massal tetap mensyaratkan otomatisasi nonaktif.

`scripts/payroll-attendance-source.py --config /private/source-config.json --period YYYY-MM --json` membaca snapshot eksekusi sumber secara read-only. Replay dipatok pada hash aturan yang telah diperiksa, diverifikasi terhadap hasil counter dan writer yang benar-benar berhasil, lalu dipasangkan dengan identitas LMS terkonfirmasi. Hanya tanggal/nama kelas yang dapat dibuktikan disimpan sebagai katalog pertemuan; jam yang tidak dapat diurai dicatat sebagai tanggal saja. Kalender yang kosong tidak diisi. Nominal tidak berasal dari katalog ini. Kelompok yang jumlahnya belum dapat dicocokkan ditahan dari rekap WA dan diberitahukan ke admin, tanpa menghalangi pengiriman form reimbursement.

QA: uji unit penggantian nilai/idempotensi, pelestarian koreksi, satu salinan penutupan, penerima nonaktif, salary sekali per periode, penolakan final, serta privasi. QA browser memakai fixture privat tanpa menyimpan data sumber ke database lokal; memeriksa satu daftar, rincian ringkas, komponen kosong, total setelah koreksi, arsip dan desktop/HP.
