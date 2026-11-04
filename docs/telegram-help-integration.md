# Pemetaan /help Telegram ke Clevio LMS

Diperiksa 4 November 2026 melalui akses baca saja pada workflow n8n Clevio `kj53kbFdM4jGLpwo`, versi `5a3e409b-8086-4a59-9c82-fe4bcd04087e`, serta halaman form publik yang ditautkan. Tidak ada perubahan workflow, kiriman form percobaan, atau pesan Telegram/WA sungguhan.

## Alur yang berjalan sekarang

`/help` menampilkan Ekskul, Weekly, S.O.P, Absen Trial/Event/Observ, Form izin, dan Guidance Coach. Ekskul/Weekly menyediakan jadwal serta administrasi; Weekly juga menyediakan Request Lesson. Menu SOP membuka lima dokumen: pelaksanaan kelas, pembagian lesson, pelanggaran, pengalihan kelas, dan pitching day. Guidance membuka folder Drive.

**Absensi tambahan:** tombol Absen → [form Tally absensi](https://tally.so/r/mZMlBA) → webhook `absensi` → baca ID Coach dan pilihan Absensi → cari coach dalam Sheet → tambah satu counter. Form mempunyai Trial, Event, Observasi, Training Online, dan Training Offline. Nama kegiatannya tidak menjadi identitas transaksi di counter tersebut. Jalur ini tidak memuat persetujuan admin atau deduplikasi berdasarkan pengajuan.

Node penambahan counter hanya menangani Trial, Event, Training Online, dan Training Offline. Pilihan Observasi memang ada pada form, tetapi tidak menambah komponen fee dalam node tersebut. Untuk implementasi LMS, user menetapkan observasi online Rp25.000 dan offline Rp50.000, dapat diubah admin berdasarkan tanggal berlaku.

**Izin:** menu izin → [form Tally izin](https://tally.so/r/m6lAPB) → webhook `Izin-Coach` → Sheet Izin → notifikasi Telegram. LMS sudah mempunyai izin/pengganti per sesi; payroll local menggunakan sumber LMS tersebut.

**Request lesson:** Weekly → [form Tally lesson](https://tally.so/r/3ERXvq), berisi ID Coach, nama coach, kelas, nama blok, dan lesson terakhir → webhook `req-lesson` → Sheet dengan status Request dan notifikasi Belum Terkirim → pemberitahuan permintaan kepada penanggung jawab lesson di Telegram. Ini proses materi pembelajaran, terpisah dari payroll.

## Bagian yang sudah diimplementasikan di local

| Menu lama | Pengganti di LMS local |
| --- | --- |
| Absensi kelas reguler | Otomatis dari sesi, kepesertaan, izin, dan pengganti LMS |
| Trial yang terjadwal di LMS | Otomatis setelah coach yang ditugaskan mengirim form penilaian; satu fee per sesi bersama; fulltime tanpa fee trial |
| Event, training, observasi | Coach ajukan → admin tinjau Setujui/Tolak → aktivitas disetujui masuk rekap setelah hitung ulang |
| Form izin | Modul izin coach LMS yang sudah ada menjadi sumber payroll |
| Rekap pemeriksaan bulanan | Halaman pribadi coach, notifikasi LMS, dan pesan teks WA rinci tanpa nominal/lampiran; PDF hanya untuk slip gaji |
| Slip gaji | Arsip versi final, penanda transfer, dan pengiriman manual per orang/massal setelah transfer |

Pengajuan tambahan menyimpan tanggal/jam, pemilik akun, kategori, judul, catatan bukti, status, mode fee, alasan keputusan, dan riwayat audit. Data tidak langsung menaikkan counter. Pengajuan identik, pengiriman ulang browser, dan review dari layar yang sudah kedaluwarsa ditolak. Pencatatan absensi trial otomatis tidak melakukan pembayaran; finance memproses pembayaran dan slip di akhir bulan. Trial tidak dapat diajukan melalui form tambahan coach; validasi memakai penilaian trial yang dikirim coach yang ditugaskan. Persetujuan tidak boleh mengubah periode final tanpa membuka revisi.

## Rencana bagian /help di luar payroll

| Bagian | Rancangan penyatuan |
| --- | --- |
| Jadwal Weekly/Ekskul | Tautkan ke daftar kelas dan sesi LMS milik coach; hindari master jadwal kedua di Sheet |
| SOP dan Guidance | Buat pusat bantuan coach di LMS, dengan kategori dan dokumen berversi yang dikelola admin. Dokumen Drive dapat tetap menjadi sumber file saat awal perpindahan; izin akses file perlu dipertahankan |
| Request lesson | Form LMS memilih kelas/blok dari penugasan coach, menampilkan lesson terakhir, dan mencatat materi yang diminta/tanggal dibutuhkan. Admin materi menerima antrean Baru → Diproses → Siap → Diterapkan; materi siap dihubungkan ke lesson/template LMS dan coach mendapat notifikasi |
| Administrasi Weekly/Ekskul | Inventaris dokumen yang benar-benar dipakai, lalu tempatkan pada kelas/pusat bantuan dengan akses coach yang sesuai |
| Transport | Tetap komponen manual payroll sesuai keputusan user; belum memindahkan sistem transport/driver n8n |

Request lesson, pusat dokumen SOP/Guidance, dan pemindahan isi administrasi **belum diimplementasikan** dalam paket payroll ini. Pemeriksaan ini memetakan alur dan rancangan integrasinya; memindahkan isinya memerlukan pemetaan dokumen, penanggung jawab materi, dan aturan penyelesaian permintaan. Jangan memindahkan seluruh bot/chatbot/transport sebagai bagian dari migrasi gaji.

## Perpindahan production kelak

Saat ini semua pengembangan dan QA menggunakan local. Sebelum cutover yang diperintahkan user: cocokkan rekap lama dan baru; pastikan pengajuan yang sedang menunggu tidak hilang; tentukan tanggal mulai; baru hentikan pintu form/counter/rekap lama yang terkait dan arahkan coach ke LMS. n8n tidak boleh tetap menambah sumber yang sama setelah LMS menjadi sumber payroll utama. Sesi WA production dan workflow lain harus tetap dipertahankan.
