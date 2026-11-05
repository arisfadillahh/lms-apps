# Panduan Absensi, Gaji, dan Slip Gaji Clevio

Status saat ini: implementasi dan data contoh berjalan **di local**. Belum dideploy, belum memigrasikan database production, dan belum mengganti otomasi n8n yang sedang aktif.

## Mencoba di local

Jalankan `npm run dev:payroll-local`, lalu buka [pilihan akun demo](http://127.0.0.1:4055). Pilih Admin Demo Lokal, Coach Mitra, Coach Fulltime, atau Coach Tanpa WA. Data operasional demo adalah contoh. Pembanding n8n memakai snapshot baca saja yang dijelaskan di bagian uji paralel. Status **Simulasi local** berarti pengiriman teks rekap atau PDF slip disimulasikan tanpa mengirim WhatsApp sungguhan.

Login admin biasa juga tersedia di [halaman login local](http://127.0.0.1:3005/login): username **admin**, password **DemoLokal2026!**. Akun finance terpisah: **finance.demo**, password **DemoLokal2026!**, dengan akses menu penggajian. Kredensial ini hanya untuk database contoh lokal.

Database demo tersimpan terpisah di `.codex-payroll-local/database`. Menjalankan kembali perintah yang sama mempertahankan data. Untuk mengembalikan contoh awal, hentikan server lalu jalankan `npm run dev:payroll-local -- --reset`. Reset ini hanya menghapus database demo tersebut.

## Alur bulanan admin

Di **Rekap & arsip**, pilih bulan/tahun pada baris periode. **Hitung ulang** dan **Finalisasi** berada di baris yang sama untuk periode draft. Tabel penerima langsung terlihat di bawahnya; jumlah penerima dan total ditampilkan sebagai ringkasan pendek. Buka **Info periode** untuk cutoff, deadline koreksi, dan syarat finalisasi. Area kerjanya dipisah:

| Area | Dipakai untuk |
| --- | --- |
| **Rekap penerima** | Memeriksa nominal, membuka rincian/pratinjau, membuat penyesuaian, dan melihat status rekap otomatis |
| **Pembayaran & slip** | Mencatat transfer yang sudah dilakukan dan mengirim slip; digunakan setelah periode final |
| **Riwayat periode** | Melihat audit, membuka revisi admin, serta memulihkan pengiriman yang menggantung |

Periode draft langsung membuka Rekap penerima. Periode final langsung membuka Pembayaran & slip. Checkbox hanya ada di **Pembayaran & slip**: centang penerima agar tombol transfer/kirim slip muncul. **Batal pilih** mengosongkan pilihan. Pindah area kerja juga mengosongkan pilihan untuk mencegah tindakan pada pilihan sebelumnya.

1. Buka **Keuangan → Gaji & Slip Gaji**. Pilih bulan/tahun; pilihan yang sama digunakan untuk membuka arsip bulan lama.
2. Klik **Hitung ulang**. Periksa nama penerima, aktivitas, pengganti, nominal, dan peringatan. Sumber yang sama tidak dihitung dua kali.
3. Buka **Rincian** untuk melihat tabel dalam popup, memperbaiki sesi, memindahkan fee ke coach pengganti, mengatur mode sesi, atau memberi nominal khusus untuk force majeure. Alasan wajib diisi. Setelah perubahan, tutup popup lalu klik **Hitung ulang**. **Pratinjau** membuka slip berlogo Clevio dalam popup tanpa mengunduh PDF. Slip merangkum seluruh fee kelas menjadi satu baris jumlah sesi dan total nominal; fee trial dan bonus goal juga diringkas. Gaji pokok, setiap tunjangan, potongan, dan komponen lain tetap tercantum masing-masing. Tanggal/nama sesi dan catatan koreksi lengkap tersedia di Rincian dan rekap absensi, bukan di slip.
4. Di popup Rincian, tombol **Tambahan / potongan** dan **Aktivitas manual** selalu berada di atas daftar. Klik untuk mengganti isi popup menjadi form khusus; tabel panjang disembunyikan sementara. Gunakan nominal negatif untuk potongan. **Kembali ke rincian** atau Escape kembali ke tabel. Penyimpanan berhasil otomatis kembali ke rincian; jika gagal, form dan isian tetap terlihat. Koreksi aktivitas memakai alur form yang sama. Pencatatan trial manual hanya untuk pengecualian admin dengan alasan; jalur normalnya otomatis dari penilaian trial. Hindari menambahkan kegiatan yang sudah terhitung dari LMS.
5. **Rekap absensi otomatis tanggal 25**, mulai 09.00 WIB, dengan pengingat terakhir mulai 16.00 WIB dan deadline koreksi 17.00 WIB. Otomatisasi harus diaktifkan di **Tarif & otomatisasi → Otomatisasi**, dan cron LMS harus berjalan. Rekap WA berupa pesan teks rinci tanpa nominal atau lampiran, untuk pemeriksaan absensi oleh coach; ini tidak menandai pembayaran. Status aktivasi terlihat di Rekap penerima dan Info periode. Di local, WA tetap disimulasikan. Kirim ulang manual hanya untuk pengecualian lewat **Rincian → Pengiriman ulang & riwayat penerima → Kirim ulang rekap (manual)**. Pengiriman manual lebih awal tidak menggantikan jadwal tanggal 25.
6. Setelah seluruh tanggal 25 selesai, klik **Finalisasi**. Sistem menghitung ulang sumber terbaru sebelum menyimpan versi final. Periode berjalan tidak dapat difinalisasi sebelum tanggal 26 pukul 00.00 WIB. Peringatan dan pengajuan koreksi berstatus Menunggu/Diproses harus diselesaikan dahulu.
7. Buka **Pembayaran & slip**. Lakukan transfer melalui bank. Setelah transfer benar-benar selesai, pilih penerima dan klik **Tandai sudah transfer**. Tombol ini mencatat penyelesaian transfer; tidak melakukan transfer bank. Jika pilihan berisi penerima yang sudah dan belum ditransfer, hanya yang belum selesai yang ditandai.
8. Pilihan penerima tetap tersimpan dan tombol utama berubah menjadi **Kirim slip gaji**. Klik untuk mengirim tanpa mencentang ulang. Untuk satu orang, cukup centang satu penerima; untuk massal, centang beberapa penerima atau semua hasil filter. Slip hanya dapat dikirim setelah final dan tercatat sudah ditransfer. Periksa hasil setiap penerima; kegagalan satu pengiriman tidak membatalkan hasil penerima lainnya.

Perhitungan, transfer, dan pengiriman memiliki status terpisah. Mengirim ulang slip tidak menambah pembayaran. Menekan penanda transfer kembali juga tidak menggandakan transfer yang sudah dicatat.

**Rekap penerima** tidak mempunyai tombol kirim rekap massal. Rekap normal dijadwalkan otomatis; **Pembayaran & slip** khusus untuk mencatat transfer dan mengirim slip. Jika masih draft, area pembayaran menjelaskan syarat finalisasi dan urutan transfer → slip.

## Periode dan deadline koreksi

Contoh periode **November 2026** mencakup **26 Oktober pukul 00.00 WIB sampai 25 November pukul 23.59.59 WIB**. Sesi tanggal 25 malam tetap masuk November. Aktivitas mulai tanggal 26 masuk periode berikutnya.

**BATAS LAPORAN KOREKSI REGULER COACH: TANGGAL 25 PUKUL 17.00 WIB.** Pesan ini tercantum di pesan teks rekap WA, notifikasi LMS, dan halaman coach. Form coach ditutup tepat pukul 17.00. Pesan coach tidak menawarkan pengecualian. **Catatan internal admin/PIC:** bila menerima laporan terlambat, perbaiki aktivitas yang sudah ada atau tambahkan kategori aktivitas yang belum tercatat, lengkap dengan tanggal, penerima, jumlah anak/online-offline bila relevan, serta alasan. Periode final harus dibuka revisi dahulu.

Tanggal 26 membuat periode baru. Riwayat bulan sebelumnya tetap tersimpan; tidak ada penghapusan absensi atau arsip gaji bulanan.

## Menyiapkan penerima dan kontrak

Di tab **Coach & staf**, klik **Tambah penerima** untuk membuka form dalam popup. Tambahkan coach dengan memilih akun LMS yang sudah ada. Pilih kontrak **Mitra** atau **Fulltime**, gaji tetap per periode, dan tanggal mulai berlaku. Kontrak dan nominal dikelola pada profil penerima oleh admin/finance. Nama coach mengikuti akun LMS. Nomor WhatsApp coach selalu diambil dari profil coach.

Untuk karyawan lain, pilih **Staf non-coach**. Isi nama, jabatan, nomor WA pribadi jika tersedia, kontrak, serta gaji pokok. Staf tidak perlu akun LMS; admin mengelola nomor WA staf di sini. Gunakan Fulltime jika penerima mempunyai gaji tetap.

Klik **Profil & tunjangan** di penerima untuk membuka popup pengaturan **Tunjangan jabatan** dan **Tambah tunjangan rutin lainnya**, misalnya komunikasi atau makan. Popup menutup setelah penyimpanan berhasil. Tunjangan rutin otomatis masuk satu kali setiap periode setelah **Hitung ulang**, mengikuti tanggal berlaku kontrak. Untuk perubahan ke depan, isi tanggal **Berlaku mulai** yang baru. Versi final bulan lama tetap tersimpan. Tunjangan rutin mengikuti nominal bulanan penuh, tanpa prorata otomatis.

Untuk tunjangan atau potongan khusus satu bulan, buka **Rekap & arsip → pilih bulan → Rekap penerima → Rincian → Tambahan / potongan**. Isi label, nominal, dan alasan. Nominal negatif menjadi potongan. Komponen ini hanya berlaku pada periode yang dipilih; tidak berulang pada bulan berikutnya. Contoh: tunjangan jabatan rutin Rp500.000 disimpan di profil, sedangkan bantuan khusus November Rp250.000 ditambahkan di rincian November.

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

Admin memilih mode Fulltime/Mitra saat membuat kelas atau melalui tab **Tarif & otomatisasi → Mode kelas**. Tidak ada pemeriksaan jam kerja atau overlap. Untuk pengecualian satu pertemuan, gunakan **Koreksi aktivitas** pada rincian periode.

Jumlah anak dihitung dari kepesertaan aktif pada tanggal sesi, bukan jumlah anak saat ini dan bukan jumlah anak yang mengisi kehadiran. Kategori tarifnya 1, 2, atau 3+ anak.

Tarif awal kelas Weekly dan Ekskul:

| Cara belajar | 1 anak | 2 anak | 3+ anak |
| --- | ---: | ---: | ---: |
| Online | Rp70.000 | Rp80.000 | Rp100.000 |
| Offline | Rp95.000 | Rp105.000 | Rp125.000 |

Tarif awal event Rp180.000, training online Rp25.000, training offline Rp50.000, observasi online Rp25.000, dan observasi offline Rp50.000 per aktivitas. Admin dapat membuat kartu tarif baru dengan tanggal berlaku, termasuk mengubah observasi dan bonus goal untuk waktu berikutnya.

Tab **Tarif & otomatisasi** hanya menampilkan pengaturan yang dipilih: **Tarif aktivitas** untuk nominal dan tanggal berlaku, **Mode kelas** untuk status mengajar, atau **Otomatisasi** untuk tanggal mulai pencatatan dan jadwal rekap.

## Aktivitas tambahan yang diajukan coach

Pada halaman **Absensi & Slip Gaji**, coach mengisi jenis aktivitas, tanggal/jam WIB, nama kegiatan, serta rincian/lokasi/referensi bukti. Identitas mengikuti akun login; tidak perlu mengetik ID Telegram. Pengajuan hanya untuk kegiatan yang sudah berlangsung dan sebelum deadline reguler periode tersebut. Event, training, observasi online/offline, tersedia. Trial menggunakan modul Trial dan tidak dapat diajukan melalui form aktivitas tambahan.

Pengajuan berstatus **Menunggu admin** dan belum menambah gaji. Admin membuka tab **Pengajuan coach → Event & kegiatan**, memilih bulan/tahun langsung di bagian atas, lalu **Tinjau aktivitas**. Periksa kegiatan dan buktinya, tentukan Setujui/Tolak, pilih mode Mitra/Fulltime untuk kegiatan tersebut, dan isi alasan. Kembali ke **Rekap & arsip** dan klik **Hitung ulang** setelah keputusan disimpan. Coach mendapat notifikasi keputusan di LMS dan dapat melihat riwayat pengajuan sendiri.

Pengajuan identik tidak dibuat dua kali. Trial tidak tersedia pada pengajuan coach untuk mencegah sumber absensi ganda. Admin dapat mengubah keputusan dengan alasan selama periode draft. Untuk periode final, buka revisi admin dahulu. Keputusan dan perubahan perhitungan dicatat bersama; versi final sebelumnya tetap utuh.

Konfirmasi invoice trial lunas yang sudah dipakai sistem pembayaran sekarang juga memicu sinkronisasi bonus goal. Bonus masuk ketika invoice pendaftaran berstatus **PAID** dan tanggal konfirmasi lunas tersedia. Callback berulang menghitung ulang sumber yang sama; tidak menambah bonus ganda. Gangguan penggajian tidak membatalkan konfirmasi pembayaran; Hitung ulang/cron memperbaiki sinkronisasi. Tanggal konfirmasi menentukan periode bonus. Bonus diberikan kepada coach assessment trial, satu kali per anak. Pencocokan anak menggunakan nama dan nomor kontak pendaftaran yang dinormalisasi. Pastikan data anak konsisten; untuk riwayat pembayaran yang tidak lengkap, periksa peringatan sebelum memberi tambahan manual.

## Absensi trial otomatis

Admin meng-assign coach melalui modul Trial yang sudah ada. Setelah trial berlangsung, coach membuka trial miliknya, melengkapi form penilaian, lalu mengirimkannya. **Draft belum dihitung**. Absensi otomatis baru valid ketika penilaian terkirim oleh coach yang ditugaskan; tidak perlu formulir absensi kedua. Pencatatan ini memperbarui rekap absensi/estimasi. Pembayaran tetap diproses finance pada akhir bulan, kemudian ditandai sudah ditransfer dan slip dikirim manual. Satu sesi bersama menghasilkan satu fee trial, meskipun penilaian beberapa anak dikirim pada waktu berbeda. Bonus goal tetap dihitung per anak. Jika satu sesi memiliki beberapa anak, satu penilaian valid cukup mencatat satu sesi, tetapi laporan anak lain yang belum lengkap ditandai sebagai peringatan admin. Lengkapi laporan atau catat hasil pemeriksaan melalui Koreksi aktivitas sebelum finalisasi.

Tanggal sesi menentukan periode fee trial. Jika penilaian terlambat masuk dan periode sudah final, sistem memberi tahu admin tanpa mengubah slip final; admin membuka revisi jika perlu. Pengiriman penilaian memicu pencatatan absensi dan sinkronisasi rekap draft, dan cron/hitung ulang dapat mengulang sinkronisasi bila sempat terjadi gangguan.

## Koreksi dan force majeure

Pilih penerima → **Rincian → Koreksi aktivitas**. Admin dapat memilih coach penerima, mode sesi, pembatalan hak fee, atau nominal paksa. Nominal paksa mengesampingkan tarif dan pembatalan; kosongkan jika ingin perhitungan normal. Isi alasan dan hitung ulang. Komponen manual dan aktivitas tambahan juga dapat dihapus dengan alasan, selama periode masih draft.

Untuk periode final, buka **Riwayat periode → Buka revisi admin**, isi alasan, lalu kembali ke **Rekap penerima** untuk melakukan koreksi dan finalisasi lagi. Sistem menyimpan versi baru dan mempertahankan versi lama serta semua catatan transfer. Jika sebelumnya sudah ditransfer Rp500.000 dan hasil revisi Rp550.000, sisa yang ditandai berikutnya Rp50.000. Jika penyesuaian disepakati masuk bulan berikutnya, admin/finance menambah komponen berlabel, nominal, dan alasan pada periode berikutnya. Tidak ada modul cicilan, penagihan kembali, atau pemindahan saldo otomatis. Nominal negatif adalah potongan; positif adalah tambahan.

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

Buka **Absensi & Slip Gaji** melalui menu coach. Pilih arsip bulan/tahun untuk melihat rincian sendiri. Detail aktivitas pada halaman dan API coach tidak memuat nominal, tarif, gaji pokok, tunjangan, total, atau riwayat transfer. Sebelum deadline, coach dapat mengajukan koreksi dan memantau Menunggu → Diproses → Selesai/Ditolak, beserta tanggapan PIC. Pengajuan tidak langsung mengubah perhitungan. Setelah final dan transfer dicatat, tombol unduh slip final tersedia. Coach tidak dapat melihat slip orang lain atau mengubah tarif, kontrak, dan penanda transfer.

## Arsip dan akses admin

Di **Rekap & arsip**, pilih bulan/tahun untuk membuka periode berjalan maupun arsip lama. Pencarian nama/jabatan berada di sebelah tab area kerja; tombol **Filter** membuka pilihan coach/staf dan fulltime/mitra. Filter transfer dan status pengiriman tersedia di **Pembayaran & slip**. Total ringkasan mengikuti hasil filter; **Reset filter** mengembalikan daftar lengkap. Penjelasan cutoff, koreksi, dan finalisasi tersedia di **Info periode**. Ikon panah melingkar di sebelah judul memuat ulang data tanpa menghitung ulang gaji.

Popup Rincian menyediakan **Pengiriman ulang & riwayat penerima** yang dapat dibuka untuk pratinjau versi final sebelumnya, riwayat transfer, dan pengiriman ulang. Audit seluruh periode ada di **Riwayat periode**. Admin melihat slip melalui popup; file PDF tetap dipakai sebagai lampiran slip yang dikirim melalui WA. Tabel di layar kecil dapat digeser ke samping untuk melihat kolom tindakan.

Hanya admin yang mempunyai izin menu **Gaji & Slip Gaji** yang dapat mengelola modul. Notifikasi koreksi diarahkan ke PIC periode yang berwenang; jika PIC belum tersedia/aktif, seluruh admin dengan akses penggajian menjadi penerima fallback. Akun finance memakai identitas login tersendiri sehingga audit mencatat siapa melakukan tindakan. Pembagian admin operasional vs finance mengikuti SOP tim, tanpa lapisan persetujuan tambahan.

## Menangani koreksi dan salah penandaan transfer

Buka **Pengajuan coach → Koreksi absensi**. Pilih PIC periode dari akun admin/finance yang mempunyai akses. Penghitungan pertama oleh admin otomatis memilih akun tersebut sebagai PIC jika masih kosong. Filter **Perlu ditangani** menampilkan Menunggu/Diproses; pilih Semua pengajuan untuk arsip.

PIC mengubah status menjadi **Diproses**, memeriksa sumber dan memperbaiki aktivitas pada Rincian penerima, lalu menandai **Selesai** atau **Ditolak** dengan alasan. Tanggapan tampil di akun coach, jadi gunakan detail aktivitas tanpa nominal. Hasil disimpan dan coach menerima notifikasi LMS. Pengajuan selesai tidak dibuka ulang; perubahan berikutnya tetap dicatat lewat audit admin.

Jika salah menandai transfer: **Rincian → Pengiriman ulang & riwayat penerima → Riwayat transfer → Batalkan penandaan**. Isi alasan. Catatan transfer asli tetap ada dengan penanda pembatalan. Tindakan ini tidak menggerakkan uang bank. Penerima kembali belum dibayar, pengiriman slip diblokir, dan akses unduh coach dihentikan sampai penandaan yang benar dibuat. File yang sudah diterima sebelumnya tentu tidak dapat ditarik dari perangkat penerima.

## Uji paralel sistem lama

November masih memakai sistem lama sebagai patokan. Desember adalah target tentatif migrasi penuh setelah hasil disepakati. Di local, **Pengajuan coach → Pembanding sistem lama** menampilkan snapshot sumber n8n tanggal 5 November: identitas 18 coach, progres hitungan, dan total estimasi. Jadwal dan izin sumber juga disimpan privat untuk persiapan pencocokan. Snapshot tidak dikirim ke GitHub dan tidak menjadi transaksi payroll demo.

Snapshot mempertahankan angka/formula sumber pada waktu baca, bukan sinkronisasi langsung. Sumber lama berisi hitungan kumulatif sehingga tanggal sesi tidak dapat direkonstruksi. Sebelum uji paralel operasional, cocokkan identitas coach, jadwal/kelas, kontrak, dan aktivitas LMS dengan sumber lama; ambil snapshot baru yang lengkap saat mulai. Belum ada pemetaan otomatis akun nyata ke akun demo dan belum ada impor kumulatif ke perhitungan pembayaran, untuk menghindari perhitungan ganda. Transport sumber tetap hanya pembanding; transport LMS manual.

## Flowchart per pengguna

### Coach

```mermaid
flowchart TD
  A[Kelas berjalan] --> B[Absensi otomatis sesuai sesi dan pengganti]
  C[Trial: coach kirim penilaian] --> B
  D[Event / training / observasi] --> E[Coach ajukan]
  E --> F[Admin setujui atau tolak]
  F --> B
  B --> G[Rekap tanggal 25 tanpa nominal]
  G --> H{Perlu koreksi sebelum 17.00?}
  H -->|Ya| I[Ajukan dan pantau tanggapan PIC]
  H -->|Tidak| J[Tunggu slip final]
  I --> J
  J --> K[Finance catat transfer dan kirim slip]
```

### Admin / PIC

```mermaid
flowchart TD
  A[Pilih periode dan PIC] --> B[Hitung ulang dan periksa rincian]
  B --> C[Tangani izin / pengganti / kegiatan / koreksi]
  C --> D{Aktivitas sudah ada?}
  D -->|Ya| E[Koreksi sumber yang sama dengan alasan]
  D -->|Belum| F[Tambah aktivitas manual dengan kategori dan alasan]
  E --> G[Selesaikan tanggapan pengajuan]
  F --> G
  G --> H[Tanggal 25 tetap mencakup aktivitas sampai 23.59.59]
  H --> I[Tanggal 26: hitung ulang, bereskan peringatan, finalisasi]
  I --> J[Serahkan ke finance]
  I --> K[Revisi terlambat: buka versi baru dengan alasan]
```

### Finance

```mermaid
flowchart TD
  A[Login akun finance] --> B[Periksa komponen rutin dan per bulan]
  B --> C[Pastikan periode final]
  C --> D[Transfer melalui bank]
  D --> E[Tandai penerima sudah ditransfer]
  E --> F{Penandaan benar?}
  F -->|Tidak| G[Batalkan penandaan dengan alasan]
  G --> D
  F -->|Ya| H[Kirim slip satu orang atau checklist massal]
  H --> I[WA pribadi; tanpa nomor coach ke LMS]
  I --> J[Arsip bulanan dan audit]
  J --> K[Penyesuaian periode berikutnya: komponen manual]
```

## Saat kelak akan digunakan di production

Aktivasi production belum dilakukan. Diperlukan instruksi terpisah untuk migrasi/deploy dan perpindahan dari n8n. Sebelum aktivasi: siapkan penerima serta kontrak, klasifikasikan kelas fulltime, tentukan tanggal mulai, cocokkan rekap contoh dengan pencatatan lama, lalu sepakati penghentian cabang absensi/gaji lama agar pesan tidak berlipat. Otomatisasi LMS baru aktif setelah admin mengaturnya; slip tetap dikirim manual setelah transfer.
