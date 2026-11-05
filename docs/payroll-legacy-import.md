# Sinkronisasi data payroll ke rekap LMS

Pengguna mengelola satu rekap melalui **Gaji & Slip Gaji → Rekap & arsip → Rekap penerima**. Data sinkronisasi menjadi komponen pada penerima dan periode yang sama. Tidak ada tab rekap pembanding. Popup Rincian menggabungkan aktivitas, jumlah dan nominal; komponen kosong tersembunyi sampai diminta, dan total terlihat di atas.

## Masa transisi

Selama November 2026, **Perbarui rekap** membaca data kumulatif terbaru yang dipakai alur n8n lalu memperbarui komponen di LMS. Komponen sinkronisasi diganti berdasarkan ID sumber, bukan ditambahkan setiap refresh. Tambahan/potongan dan koreksi admin tetap tersimpan. Pengiriman WA payroll tetap nonaktif. Koneksi sumber dibatasi sampai periode November; periode berikutnya memakai sumber aktivitas LMS normal setelah tanggal mulai diatur admin. Tidak ada perubahan workflow atau data n8n.

Arsip November 2025–Oktober 2026 memakai satu salinan penutupan per bulan; alternatif Desember 2025 tetap disimpan sebagai bukti internal dan tidak dijumlahkan. Nominal historis tidak dihitung ulang memakai tarif atau gaji pokok terbaru. Jumlah dan fee kumulatif ditampilkan sebagai rekap bulanan tanpa membuat tanggal sesi fiktif. Kolom manual tanpa judul Agustus tetap diabaikan sesuai keputusan pengguna.

## Integritas dan akses

- Identitas dipasangkan dengan ID yang telah dikonfirmasi. Dua identitas Naufal menuju satu penerima. Identitas yang dikecualikan tetap ada dalam bukti mentah dan tidak masuk daftar penerima.
- Tarif sumber dan jumlah aktivitas dipertahankan. Komponen yang belum memiliki nominal tidak dianggap sebagai nilai yang telah disetujui; admin dapat mengoreksi dengan alasan.
- Gaji pokok/tunjangan rutin diterapkan satu kali pada periode berjalan. Gaji pokok fulltime yang belum diatur tetap menghalangi finalisasi. Gaji pokok sekarang tidak disisipkan ke arsip lama.
- Sinkronisasi tidak membuat penanda transfer, mengirim pesan atau mengganti versi final. Periode final harus dibuka melalui revisi beralasan sebelum data diperbarui.
- Coach dan coach lead hanya menerima aktivitas dan jumlah melalui proyeksi yang diizinkan, tanpa nominal atau detail koneksi sumber.

## Operasional teknis

`legacy_imports` dan `legacy_links` tetap menjadi bukti internal pada dokumen periode. `calculateSynchronizedPeriod` mengubah bukti tersebut menjadi slip/komponen rekap LMS yang sama dengan alur pembayaran. Pada periode transisi, sumber kumulatif dan sesi otomatis LMS tidak dijumlahkan sebagai dua feed. Aktivitas/manual yang ditambahkan operator tetap terpisah sebagai koreksi eksplisit pada rekap yang sama.

`node scripts/unify-payroll-periods.mjs --env /private/.env` melakukan dry-run seluruh arsip. Tambahkan `--apply --backup-dir /private/backups` untuk menyimpan backup dan melakukan pembaruan dengan pemeriksaan revisi serta audit. `--period YYYY-MM` membatasi satu periode. Profil, kontrak, kontak, transfer dan riwayat final tidak ditimpa.

`scripts/sync-payroll-source.py --config /private/source-config.json --env /private/.env` memeriksa akses sumber secara read-only. `--apply` menyimpan salinan mentah privat, memperbarui bukti sumber dan menghitung ulang satu rekap LMS. Kredensial dibaca di tempat tanpa ditulis ulang. Koneksi ini dipanggil oleh tombol Perbarui rekap, terpisah dari pengaturan pengiriman otomatis.

QA: uji unit penggantian nilai/idempotensi, pelestarian koreksi, satu salinan penutupan, penerima nonaktif, salary sekali per periode, penolakan final, serta privasi. QA browser memakai fixture privat tanpa menyimpan data sumber ke database lokal; memeriksa satu daftar, rincian ringkas, komponen kosong, total setelah koreksi, arsip dan desktop/HP.
