# Pemeriksaan alur pertama kali: absensi dan penggajian

Tanggal: 5 November 2026. Lingkungan: localhost, database demo persisten. Tidak ada deploy, perubahan VPS/production, transfer bank, atau pengiriman WA/Telegram/email sungguhan.

## Kesimpulan

Alur tugas utama dapat diselesaikan melalui login dan kontrol yang terlihat di layar. Pemisahan pekerjaan sudah mengikuti keputusan tim: admin dan coach lead menangani operasional koreksi; finance tetap dapat mengoreksi untuk kebutuhan seperti force majeure dengan alasan dan audit.

Ini adalah simulasi tugas oleh pengembang dan pengujian browser otomatis, bukan hasil pengujian dengan anggota tim yang belum pernah memakai aplikasi. Karena penguji mengetahui kebutuhan produk, hasil ini belum membuktikan semua pengguna akan langsung memahami setiap istilah. Sebelum pemakaian operasional, minta anggota tim mencoba tugas pada bagian akhir tanpa membuka panduan.

## Hambatan yang ditemukan dan diperbaiki

| Sebelumnya | Perubahan | Manfaat untuk pengguna baru |
| --- | --- | --- |
| Akun dengan satu tugas masuk dashboard umum | Finance khusus langsung ke penggajian; coach lead khusus langsung ke absensi | Tidak perlu mencari menu pertama |
| Menu absensi belum muncul di shell admin sebenarnya | Menu ditambahkan pada navigasi desktop dan HP | Ruang kerja dapat ditemukan lagi setelah pindah halaman |
| Pengajuan koreksi terpisah dari daftar aktivitas | **Periksa aktivitas coach** membuka daftar yang sudah difilter; pada penggajian membuka Rincian penerima | Tidak perlu menebak aktivitas siapa yang perlu diperiksa |
| Koreksi operasional harus dilanjutkan dengan hitung ulang manual | Penyimpanan di ruang kerja absensi otomatis memperbarui daftar | Hasil terlihat setelah simpan; kegagalan refresh dijelaskan tanpa menyuruh input ulang |
| Form tinjauan kegiatan muncul di bawah daftar panjang | **Tinjau aktivitas** membuka popup; kegagalan tetap ditampilkan di dalam popup | Form dan hasil penyimpanan tidak terlewat |
| Finalisasi dinonaktifkan tanpa penjelasan yang langsung terlihat | Alasan tampil di baris periode: tanggal, koreksi, peringatan, atau kebutuhan hitung ulang | Pengguna mengetahui apa yang perlu diselesaikan |
| Status pengiriman memakai kode teknis | Label seperti **Belum dikirim**, **Terkirim WA**, **Simulasi local** pada tabel dan hasil pengiriman | Status dapat dibaca tanpa memahami kode sistem |
| Tab absensi terpotong dan nama penerima sempit di HP | Ketiga tab terlihat; kolom nama diberi lebar minimum, tabel memiliki petunjuk geser | Pilihan tidak tersembunyi dan nama lebih mudah dibaca |
| Login kadang kembali ke formulir | Redirect server tidak lagi tertelan catch; navigasi tidak menjalankan replace/refresh bersamaan; penolakan CSRF eksplisit dicoba ulang sekali melalui validasi normal | Sesi baru membuka ruang kerja yang sesuai; kegagalan tetap ditampilkan pada form |
| Dashboard coach lokal gagal memuat relasi dan hitungan portofolio | Adapter lokal mendukung embed FK-column; tabel portofolio dimuat dari DDL repository | Pengujian dimulai dari dashboard biasa, bukan hanya tautan pintas |

Warna, tombol, font, dan popup tetap mengikuti dashboard admin yang sudah ada. Tidak ditambahkan panel petunjuk besar di atas tabel penerima.

## Pembagian akses

| Pengguna | Pekerjaan normal | Akses nominal dan pembayaran |
| --- | --- | --- |
| Coach | Memeriksa aktivitas sendiri, mengajukan koreksi/kegiatan sebelum deadline, membaca tanggapan | Aktivitas tanpa nominal; slip final sendiri setelah penanda transfer |
| Coach lead | Meninjau koreksi, memperbaiki penugasan/aktivitas, meninjau kegiatan | Tidak mendapat nominal, API penggajian, PDF, atau kontrol pembayaran |
| Admin | PIC operasional, pengaturan akun, koreksi dan pengelolaan sesuai izin | Sesuai izin menu; admin penuh memiliki penggajian |
| Finance | Memeriksa rekap, finalisasi, penanda transfer, kirim slip | Memiliki penggajian; tetap boleh mengoreksi termasuk force majeure |

Coach lead menggunakan mekanisme akun admin terbatas dengan izin **Absensi & koreksi coach**, tanpa memberi superadmin. Notifikasi dan pilihan PIC rutin berasal dari admin/coach lead yang berizin. Izin penggajian saja tidak menjadikan finance PIC operasional otomatis.

Pemeriksaan akses dilakukan di server. Endpoint operasional mengirim proyeksi aktivitas, bukan dokumen payroll mentah. Perintah pembayaran, perubahan nominal, target staf, serta perubahan bonus goal melalui endpoint operasional ditolak. Koreksi operasional mempertahankan nominal khusus yang sebelumnya ditetapkan pihak berwenang.

## Skenario browser

Pengujian menggunakan login username/password biasa di `http://127.0.0.1:3005/login`. Tautan preview tidak digunakan untuk melewati langkah login dalam simulasi pengguna baru.

| Skenario | Hasil |
| --- | --- |
| Coach menemukan absensi melalui navigasi, mengajukan koreksi dan kegiatan | Lulus |
| Coach lead langsung masuk ruang kerja, membuka aktivitas pengaju, menyimpan koreksi dan menyelesaikan tanggapan | Lulus |
| Coach lead meninjau kegiatan melalui popup | Lulus |
| Finance melihat alasan finalisasi belum tersedia | Lulus |
| Finance membuka arsip, memilih penerima, menandai transfer, lalu mengirim slip simulasi | Lulus |
| Tab absensi terlihat penuh di HP; tidak ada overflow halaman atau exception/console error pada alur | Lulus |
| Login coach, coach lead, finance, admin masing-masing tiga kali | 12 login lulus |
| Empat akun tersebut masing-masing tiga kali dengan kegagalan CSRF pertama yang sengaja disimulasikan | 12 login pulih melalui retry; validasi keamanan tetap aktif |
| Endpoint tanpa login, akun coach biasa, admin terbatas; injeksi nominal dan akses PDF coach lead | Ditolak sesuai batas akses |
| Notifikasi koreksi menuju PIC operasional; finance melakukan koreksi beralasan | Lulus |

Penanda pembayaran arsip yang digunakan dalam skenario adalah data contoh lokal. Skrip membatalkan penanda demo secara tercatat sebagai persiapan, lalu menandainya kembali melalui UI. Tidak ada operasi bank. Semua pengiriman slip memakai mode simulasi.

## Verifikasi teknis

- Vitest: **759 tes, 134 berkas lulus**. Setelah koreksi tipe fixture login (`error: null`), tiga tes login terkait dijalankan ulang dan lulus.
- Lint seluruh 36 berkas kode yang berubah: lulus.
- `tsc --noEmit` dan `npm run build` (Turbopack, konfigurasi dummy lokal): lulus. Build masih menampilkan peringatan lama React 18 dan pelacakan filesystem dinamis di modul WhatsApp; modul tersebut tidak diubah dalam pekerjaan ini.
- Skrip browser: `scripts/qa-payroll-first-use-local.mjs`, opsi `--login-only` / `--csrf-retry`, dan `scripts/qa-payroll-attendance-local.mjs`.
- Screenshot desktop/HP dan hasil lokal berada di `.codex-payroll-local/qa-first-use/` dan `.codex-payroll-local/qa-attendance/`. Artefak lokal ini tidak dimasukkan ke Git.
- Panduan yang diperbarui: [Panduan pengguna payroll](./payroll-user-guide.md).

## Uji singkat untuk tim

Berikan tugas, tanpa menyebut nama tombol atau urutan klik:

1. Coach: temukan aktivitas bulan ini dan laporkan satu kegiatan yang perlu diperiksa.
2. Coach lead: cari pengajuan tersebut, periksa aktivitas coach yang tepat, lalu selesaikan dengan tanggapan.
3. Coach lead: tinjau satu pengajuan event dan jelaskan bagaimana melihat hasilnya.
4. Finance: jelaskan mengapa periode berjalan belum bisa final, lalu buka arsip dan kirim slip satu penerima yang sudah ditransfer.
5. Admin: atur satu tunjangan rutin dan satu tambahan khusus bulan tertentu; pastikan tim dapat membedakannya.

Catat titik berhenti, salah klik, dan bantuan yang diminta. Jika istilah seperti **PIC**, **Finalisasi**, atau **Mode penugasan** masih membingungkan, perbaiki label/keterangan di lokasi tersebut berdasarkan observasi. Pemeriksaan ini tidak mengaktifkan migrasi: sistem lama masih menjadi patokan bulan berjalan; rekonsiliasi data nyata dan pengiriman pada perangkat WA tetap perlu dilakukan saat peluncuran diotorisasi.
