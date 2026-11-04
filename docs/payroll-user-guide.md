# Panduan Absensi, Gaji, dan Slip Gaji Clevio

Status saat ini: implementasi dan data contoh berjalan **di local**. Belum dideploy, belum memigrasikan database production, dan belum mengganti otomasi n8n yang sedang aktif.

## Mencoba di local

Jalankan `npm run dev:payroll-local`, lalu buka [pilihan akun demo](http://127.0.0.1:4055). Pilih Admin Demo Lokal, Coach Mitra, Coach Fulltime, atau Coach Tanpa WA. Semua data adalah contoh. Status **Simulasi local** berarti pengiriman teks rekap atau PDF slip disimulasikan tanpa mengirim WhatsApp sungguhan.

Login admin biasa juga tersedia di [halaman login local](http://127.0.0.1:3005/login): username **admin**, password **DemoLokal2026!**. Kredensial ini hanya untuk database contoh lokal.

Database demo tersimpan terpisah di `.codex-payroll-local/database`. Menjalankan kembali perintah yang sama mempertahankan data. Untuk mengembalikan contoh awal, hentikan server lalu jalankan `npm run dev:payroll-local -- --reset`. Reset ini hanya menghapus database demo tersebut.

## Alur bulanan admin

1. Buka **Keuangan → Gaji & Slip Gaji**. Pilih bulan/tahun atau arsip tersimpan.
2. Klik **Hitung ulang**. Periksa nama penerima, aktivitas, pengganti, nominal, dan peringatan. Sumber yang sama tidak dihitung dua kali.
3. Buka **Rincian** untuk melihat tabel dalam popup, memperbaiki sesi, memindahkan fee ke coach pengganti, mengatur mode sesi, atau memberi nominal khusus untuk force majeure. Alasan wajib diisi. Setelah perubahan, tutup popup lalu klik **Hitung ulang**. **Pratinjau** membuka slip berlogo Clevio dalam popup tanpa mengunduh PDF. Slip merangkum seluruh fee kelas menjadi satu baris jumlah sesi dan total nominal; fee trial dan bonus goal juga diringkas. Gaji pokok, setiap tunjangan, potongan, dan komponen lain tetap tercantum masing-masing. Tanggal/nama sesi dan catatan koreksi lengkap tersedia di Rincian dan rekap absensi, bukan di slip.
4. Tambahkan transport, tunjangan, atau potongan melalui **Tambahan / potongan manual**. Gunakan nominal negatif untuk potongan. Event dan training dapat dicatat melalui **Aktivitas tambahan**. Pencatatan trial manual hanya untuk pengecualian admin dengan alasan; jalur normalnya otomatis dari penilaian trial. Hindari menambahkan kegiatan yang sudah terhitung dari LMS.
5. Tanggal 25, kirim rekap agar coach memeriksa datanya. Rekap WA berupa pesan teks rinci tanpa nominal dan tanpa lampiran; file hanya dipakai untuk slip gaji. Jika otomatisasi sudah diaktifkan, rekap dijadwalkan setelah 09.00 WIB dan pengingat terakhir setelah 16.00 WIB melalui cron LMS. Admin tetap dapat mengirim atau mengirim ulang rekap sendiri.
6. Setelah seluruh tanggal 25 selesai, klik **Finalisasi**. Sistem menghitung ulang sumber terbaru sebelum menyimpan versi final. Periode berjalan tidak dapat difinalisasi sebelum tanggal 26 pukul 00.00 WIB. Peringatan harus diselesaikan dahulu.
7. Lakukan transfer melalui bank. Setelah transfer benar-benar selesai, pilih penerima dan klik **Tandai sudah transfer**. Tombol ini mencatat penyelesaian transfer; tidak melakukan transfer bank. Jika pilihan berisi penerima yang sudah dan belum ditransfer, hanya yang belum selesai yang ditandai.
8. Pilihan penerima tetap tersimpan dan tombol utama berubah menjadi **Kirim slip gaji**. Klik untuk mengirim tanpa mencentang ulang. Untuk satu orang, tombol **Kirim WA** di baris penerima juga tersedia. Slip hanya dapat dikirim setelah final dan tercatat sudah ditransfer. Periksa hasil setiap penerima; kegagalan satu pengiriman tidak membatalkan hasil penerima lainnya.

Perhitungan, transfer, dan pengiriman memiliki status terpisah. Mengirim ulang slip tidak menambah pembayaran. Menekan penanda transfer kembali juga tidak menggandakan transfer yang sudah dicatat.

Saat draft, tindakan massal hanya menampilkan **Kirim rekap absensi**. Setelah final, tombol utama mengikuti tahap transfer/slip. Aksi **Kirim rekap absensi** tetap tersedia terpisah untuk mengirim pesan absensi tanpa nominal dan tanpa lampiran.

## Periode dan deadline koreksi

Contoh periode **November 2026** mencakup **26 Oktober pukul 00.00 WIB sampai 25 November pukul 23.59.59 WIB**. Sesi tanggal 25 malam tetap masuk November. Aktivitas mulai tanggal 26 masuk periode berikutnya.

**BATAS LAPORAN KOREKSI REGULER COACH: TANGGAL 25 PUKUL 17.00 WIB.** Pesan ini tercantum di pesan teks rekap WA, notifikasi LMS, dan halaman coach. Setelah deadline, coach menghubungi admin untuk pengecualian. Admin tetap dapat memperbaiki periode lama dengan alasan tercatat.

Tanggal 26 membuat periode baru. Riwayat bulan sebelumnya tetap tersimpan; tidak ada penghapusan absensi atau arsip gaji bulanan.

## Menyiapkan penerima dan kontrak

Di tab **Coach & staf**, tambahkan coach dengan memilih akun LMS yang sudah ada. Pilih kontrak **Mitra** atau **Fulltime**, gaji tetap per periode, dan tanggal mulai berlaku. Kontrak ini juga terlihat di profil coach. Nama coach mengikuti akun LMS. Nomor WhatsApp coach selalu diambil dari profil coach.

Untuk karyawan lain, pilih **Staf non-coach**. Isi nama, jabatan, nomor WA pribadi jika tersedia, kontrak, serta gaji pokok. Staf tidak perlu akun LMS; admin mengelola nomor WA staf di sini. Gunakan Fulltime jika penerima mempunyai gaji tetap.

Klik **Profil & tunjangan** di penerima untuk mengatur **Tunjangan jabatan** dan **Tambah tunjangan rutin lainnya**, misalnya komunikasi atau makan. Tunjangan rutin otomatis masuk satu kali setiap periode setelah **Hitung ulang**, mengikuti tanggal berlaku kontrak. Untuk perubahan ke depan, isi tanggal **Berlaku mulai** yang baru. Versi final bulan lama tetap tersimpan. Tunjangan rutin mengikuti nominal bulanan penuh, tanpa prorata otomatis.

Untuk tunjangan atau potongan khusus satu bulan, buka **Rekap & arsip → pilih bulan → Rincian penerima → Tambahan / potongan manual**. Isi label, nominal, dan alasan. Nominal negatif menjadi potongan. Komponen ini hanya berlaku pada periode yang dipilih; tidak berulang pada bulan berikutnya. Contoh: tunjangan jabatan rutin Rp500.000 disimpan di profil, sedangkan bantuan khusus November Rp250.000 ditambahkan di rincian November.

Gaji tetap merupakan nominal satu periode, tanpa prorata otomatis. Untuk masuk/keluar di tengah periode atau penyesuaian khusus, admin mencatat komponen tambahan/potongan beralasan. Perubahan kontrak dan tarif memakai tanggal berlaku. Versi final yang sudah tersimpan tidak ikut berubah.

## Cara menentukan hak fee

| Aktivitas / keadaan | Perhitungan |
| --- | --- |
| Sesi kelas yang berjalan | Otomatis masuk rekap sesuai jadwal; coach tidak perlu check-in |
| Aktivitas dibatalkan | Tidak dibayar |
| Izin coach disetujui tanpa pengganti | Tidak ada fee untuk coach yang izin |
| Ada coach pengganti | Fee masuk ke coach pengganti, bukan coach utama |
| Mitra mengajar kelas | Mendapat tarif sesi sesuai jenis kelas, online/offline, dan jumlah anak aktif |
| Fulltime, mode kelas Fulltime | Tercakup gaji tetap; tidak ada tambahan fee sesi |
| Fulltime, mode kelas Mitra | Mendapat fee mitra untuk kelas tersebut |
| Trial oleh coach mitra | Rp25.000 per sesi bersama setelah coach yang ditugaskan mengirim penilaian trial; satu fee meskipun beberapa anak |
| Trial oleh coach fulltime | Tidak mendapat fee trial; bonus goal tetap berlaku |
| Anak goal | Bonus awal Rp100.000 per anak; 5 anak = Rp500.000 |
| Transport | Diisi manual oleh admin |

Admin memilih mode Fulltime/Mitra saat membuat kelas atau melalui tab **Tarif & otomatisasi → Mode mengajar per kelas**. Tidak ada pemeriksaan jam kerja atau overlap. Untuk pengecualian satu pertemuan, gunakan **Koreksi aktivitas** pada rincian periode.

Jumlah anak dihitung dari kepesertaan aktif pada tanggal sesi, bukan jumlah anak saat ini dan bukan jumlah anak yang mengisi kehadiran. Kategori tarifnya 1, 2, atau 3+ anak.

Tarif awal kelas Weekly dan Ekskul:

| Cara belajar | 1 anak | 2 anak | 3+ anak |
| --- | ---: | ---: | ---: |
| Online | Rp70.000 | Rp80.000 | Rp100.000 |
| Offline | Rp95.000 | Rp105.000 | Rp125.000 |

Tarif awal event Rp180.000, training online Rp25.000, training offline Rp50.000, observasi online Rp25.000, dan observasi offline Rp50.000 per aktivitas. Admin dapat membuat kartu tarif baru dengan tanggal berlaku, termasuk mengubah observasi dan bonus goal untuk waktu berikutnya.

## Aktivitas tambahan yang diajukan coach

Pada halaman **Absensi & Slip Gaji**, coach mengisi jenis aktivitas, tanggal/jam WIB, nama kegiatan, serta rincian/lokasi/referensi bukti. Identitas mengikuti akun login; tidak perlu mengetik ID Telegram. Pengajuan hanya untuk kegiatan yang sudah berlangsung dan sebelum deadline reguler periode tersebut. Event, training, observasi online/offline, tersedia. Trial menggunakan modul Trial dan tidak dapat diajukan melalui form aktivitas tambahan.

Pengajuan berstatus **Menunggu admin** dan belum menambah gaji. Admin membuka tab **Aktivitas coach**, memilih periode melalui Rekap & arsip, lalu **Tinjau aktivitas**. Periksa kegiatan dan buktinya, tentukan Setujui/Tolak, pilih mode Mitra/Fulltime untuk kegiatan tersebut, dan isi alasan. Klik **Hitung ulang** setelah keputusan disimpan. Coach mendapat notifikasi keputusan di LMS dan dapat melihat riwayat pengajuan sendiri.

Pengajuan identik tidak dibuat dua kali. Trial tidak tersedia pada pengajuan coach untuk mencegah sumber absensi ganda. Admin dapat mengubah keputusan dengan alasan selama periode draft. Untuk periode final, buka revisi admin dahulu. Keputusan dan perubahan perhitungan dicatat bersama; versi final sebelumnya tetap utuh.

Bonus goal otomatis masuk ketika invoice pendaftaran berstatus **PAID** dan tanggal konfirmasi lunas tersedia. Tanggal konfirmasi menentukan periode bonus. Bonus diberikan kepada coach assessment trial, satu kali per anak. Pencocokan anak menggunakan nama dan nomor kontak pendaftaran yang dinormalisasi. Pastikan data anak konsisten; untuk riwayat pembayaran yang tidak lengkap, periksa peringatan sebelum memberi tambahan manual.

## Absensi trial otomatis

Admin meng-assign coach melalui modul Trial yang sudah ada. Setelah trial berlangsung, coach membuka trial miliknya, melengkapi form penilaian, lalu mengirimkannya. **Draft belum dihitung**. Absensi otomatis baru valid ketika penilaian terkirim oleh coach yang ditugaskan; tidak perlu formulir absensi kedua. Pencatatan ini memperbarui rekap absensi/estimasi. Pembayaran tetap diproses finance pada akhir bulan, kemudian ditandai sudah ditransfer dan slip dikirim manual. Satu sesi bersama menghasilkan satu fee trial, meskipun penilaian beberapa anak dikirim pada waktu berbeda. Bonus goal tetap dihitung per anak.

Tanggal sesi menentukan periode fee trial. Jika penilaian terlambat masuk dan periode sudah final, sistem memberi tahu admin tanpa mengubah slip final; admin membuka revisi jika perlu. Pengiriman penilaian memicu pencatatan absensi dan sinkronisasi rekap draft, dan cron/hitung ulang dapat mengulang sinkronisasi bila sempat terjadi gangguan.

## Koreksi dan force majeure

Pilih penerima → **Rincian → Koreksi aktivitas**. Admin dapat memilih coach penerima, mode sesi, pembatalan hak fee, atau nominal paksa. Nominal paksa mengesampingkan tarif dan pembatalan; kosongkan jika ingin perhitungan normal. Isi alasan dan hitung ulang. Komponen manual dan aktivitas tambahan juga dapat dihapus dengan alasan, selama periode masih draft.

Untuk periode final, klik **Buka revisi admin**, isi alasan, lakukan koreksi, lalu finalisasi lagi. Sistem menyimpan versi baru dan mempertahankan versi lama serta semua catatan transfer. Jika sebelumnya sudah ditransfer Rp500.000 dan hasil revisi Rp550.000, sisa yang ditandai berikutnya Rp50.000. Jika hasil revisi lebih rendah, kelebihan ditampilkan untuk penyelesaian admin; sistem tidak menarik uang secara otomatis.

## WhatsApp, notifikasi LMS, dan PDF

| Status | Artinya / tindakan |
| --- | --- |
| Belum dikirim | Belum ada pengiriman slip untuk versi ini |
| Terkirim WA / SENT | Pengiriman dokumen diterima layanan WhatsApp; bukan bukti sudah dibaca |
| Hanya LMS / LMS_ONLY | Coach tidak mempunyai nomor WA; notifikasi dan rincian tetap ada di akun LMS |
| Tanpa kontak / NO_CONTACT | Staf tidak memiliki nomor WA; admin diberi notifikasi. Lengkapi nomor melalui Profil & tunjangan, lalu kirim ulang |
| Gagal / FAILED | Periksa nomor/koneksi, lalu kirim ulang dari rincian penerima |
| Sedang dikirim / SENDING | Tunggu hasil; hindari menekan ulang |
| Simulasi local / SIMULATED | Khusus preview local: PDF dibuat, tidak ada pesan WA sungguhan |

Rekap dan pengingat dikirim sebagai pesan teks berisi tanggal, kelas/kegiatan, jenis aktivitas, jumlah anak jika relevan, status pengganti/pembatalan, serta deadline. Pesan ini tidak memuat nominal, gaji tetap, bonus, potongan, atau lampiran. File PDF hanya digunakan untuk slip gaji setelah finance menandai transfer, langsung ke nomor pribadi tanpa tautan publik. Pengiriman ulang normal tidak menggandakan hasil yang sudah berhasil. Jika proses menggantung lebih dari 10 menit, admin dapat memulihkan status dengan alasan; periksa WA terlebih dahulu untuk memastikan dokumen belum terkirim sebelum mencoba ulang.

## Penggunaan oleh coach

Buka **Absensi & Slip Gaji** melalui menu coach. Pilih arsip bulan/tahun untuk melihat rincian sendiri. Sebelum deadline, coach dapat mengirim laporan koreksi kepada admin; laporan tersebut tidak langsung mengubah nominal. Setelah final dan transfer dicatat, tombol unduh slip final tersedia. Coach tidak dapat melihat slip orang lain atau mengubah tarif, kontrak, dan penanda transfer.

## Arsip dan akses admin

Tab **Rekap & arsip** menyediakan filter bulan/tahun, nama/jabatan, coach/staf, fulltime/mitra, penyelesaian transfer, serta status pengiriman. Total ringkasan mengikuti hasil filter. Popup Rincian menyediakan pratinjau versi final sebelumnya, riwayat transfer, dan audit perubahan periode. Admin melihat slip melalui popup; file PDF tetap dipakai sebagai lampiran slip yang dikirim melalui WA. Tabel di layar kecil dapat digeser ke samping untuk melihat kolom tindakan.

Hanya admin yang mempunyai izin menu **Gaji & Slip Gaji** yang dapat mengelola modul. Notifikasi koreksi dan masalah pengiriman juga hanya ditujukan kepada admin yang mempunyai akses tersebut.

## Saat kelak akan digunakan di production

Aktivasi production belum dilakukan. Diperlukan instruksi terpisah untuk migrasi/deploy dan perpindahan dari n8n. Sebelum aktivasi: siapkan penerima serta kontrak, klasifikasikan kelas fulltime, tentukan tanggal mulai, cocokkan rekap contoh dengan pencatatan lama, lalu sepakati penghentian cabang absensi/gaji lama agar pesan tidak berlipat. Otomatisasi LMS baru aktif setelah admin mengaturnya; slip tetap dikirim manual setelah transfer.
