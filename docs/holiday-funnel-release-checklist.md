# Checklist rilis Holiday funnel

Branch review: `codex/holiday-funnel`. Dokumen ini tidak memberikan izin deploy atau pengiriman pesan.

## Lokal dan Sandbox

1. Jalankan tes fokus Holiday, suite penuh, lint file berubah, TypeScript dan build. Dua kegagalan baseline yang boleh tetap: `coachMobileHeader.contract.spec.ts` dan `coachStudentAttendanceFlow.spec.ts`. Jika patch Next.js membuat kegagalan tambahan, jangan rilis patch tersebut.
2. Jalankan `node scripts/verify-holiday-sandbox.mjs` tanpa konfigurasi. Harus SKIPPED, tanpa request eksternal. Tidak memuat `.env` secara otomatis.
3. Mode lokal: `node scripts/verify-holiday-sandbox.mjs --mock`; pengulangan `--mock --resume`. Semua invoice sintetis berada di PGlite lokal, tidak ada transport WA. Kunci production maupun URL database eksternal harus ditolak bahkan pada mode mock.
4. Untuk mode sungguhan, operator memasok konfigurasi uji melalui proses shell yang sudah aman (jangan taruh nilai di chat/repo): `MIDTRANS_SANDBOX_SERVER_KEY`, `META_CONVERSIONS_API_TOKEN`, `META_TEST_EVENT_CODE`, `NEXT_PUBLIC_META_PIXEL_ID`. Jangan menjalankan dengan environment production LMS. Skrip hanya menerima prefix kunci Sandbox dan selalu memakai domain Sandbox hardcoded.
5. Jalankan skrip. Dua invoice Holiday sintetis dibuat lokal; QRIS dan BNI VA diterbitkan di Sandbox. Callback merchant dioverride ke sink `example.invalid`, sehingga tidak mencapai LMS production. Jika merchant menolak override ini, berhenti dan review konfigurasi Sandbox; jangan menghapus guard.
6. Buka simulator resmi Midtrans dan gunakan QR/nomor VA dari file `.data/qa/holiday-sandbox/state.json`. Tidak menggunakan uang asli. Jalankan ulang `--resume` setelah pembayaran simulasi. Skrip membaca status provider, lalu mensimulasikan dan mengulang notifikasi settlement di database lokal. Purchase harus satu per invoice, dengan gross termasuk admin dan ID nomor invoice. State `CREATING` yang ambigu tidak otomatis menerbitkan order baru.
7. Jangan menyebut gateway lulus bila masih PENDING. Selesaikan kedua simulator lalu pastikan `complete:true`, dua Purchase dan `whatsappSent:0` pada report. Tidak ada peserta/invoice di database production.

Sumber: [Midtrans testing payments](https://docs.midtrans.com/docs/testing-payment-on-sandbox), [QRIS Core API](https://docs.midtrans.com/reference/qris).

## Meta Events Manager

1. Pilih dataset/Pixel yang sesuai, buka **Test Events**, ambil test event code melalui operator. Token hanya di environment proses uji, tidak ditulis ke repo/server production oleh sesi ini.
2. Jalankan skrip mode Sandbox. Pastikan CompleteRegistration, InitiateCheckout dan Purchase muncul sebagai Server events dengan ID sama seperti report lokal dan currency IDR. HTTP accepted saja belum membuktikan dedup browser.
3. Buka landing staging/local melalui Test Browser Events. Lakukan pendaftaran sintetis dan pilih QRIS/VA. CompleteRegistration harus memakai UUID pendaftaran canonical; InitiateCheckout memakai `checkout:<nomor invoice>`.
4. Periksa Browser + Server event dengan event_name dan event_id sama. Pastikan dihitung satu/deduplicated, bukan dua konversi. Periksa Network/console: tidak ada blokir CSP; token URL invoice tidak dikirim sebagai event_source_url/referrer ke Meta. Purchase saat ini server-only dan harus tetap satu meski notifikasi diulang.
5. Gagal bila ID berbeda, Purchase dari pembayaran pending, nominal tanpa admin berbeda dari total UI, atau event hilang saat redirect. Jangan menyatakan browser dedup lulus hanya dari skrip server.

Sumber: [Meta Conversions API dan Test Events](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api).

## Pemeriksaan invoice HP

- Lebar 360px dan 1280px: QRIS pertama, terpilih dan terlihat; BNI, BRI setelahnya; sisanya di Bank lain. Biaya admin tampil sebelum memilih.
- Gagalkan pembuatan QRIS: pesan jelas dan VA ditawarkan, bukan halaman error. Pastikan nomor VA dapat disalin.
- QR cukup besar, Simpan QR bekerja, petunjuk galeri jelas, QR expired dapat dibuat ulang. Total harus sama dengan value InitiateCheckout.
- Default invoice baru: tiga hari, dibatasi tanggal mulai kelas. H+1 dan H+3 berdasarkan tanggal WIB, 09.00–19.59, termasuk pendaftaran malam. Lunas/dibatalkan/kedaluwarsa menghentikan pengingat; jatuh tempo invoice lama tetap.
- Lighthouse accessibility ≥90, tanpa overflow. Invoice bulanan harus tetap sama.
- GoPay/ShopeePay tetap tidak ditampilkan tanpa adapter deeplink yang terverifikasi dan konfigurasi merchant aktif. Flag `HOLIDAY_GOPAY_ENABLED`/`HOLIDAY_SHOPEEPAY_ENABLED` sendiri tidak menjadikan adapter yang belum tersedia aman dipublikasikan.

## Urutan publikasi setelah izin terpisah

1. Backup dan review migration baru, kemudian terapkan berurutan di environment yang disetujui. Jangan mengubah jatuh tempo invoice lama. Pengingat tetap default false.
2. Deploy SHA LMS yang disetujui dan verifikasi healthcheck serta invoice biasa.
3. **Publikasikan landing static setelah LMS**, mengikuti [runbook landing](../../ops/holiday-landing/README.md). Normal deploy LMS tidak mempublikasikan container static tersebut.
4. Jalankan pemeriksa hash read-only terhadap URL staging/live yang disetujui. Verifikasi script versi baru dan lakukan tes visual.
5. Baru sesudah pengukuran/pembayaran lolos, pertimbangkan konfigurasi CAPI, bantuan CS dan aktivasi pengingat. Tidak mengaktifkan WA atau menulis nilai env otomatis dari alat QA.
