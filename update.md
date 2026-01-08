
# PRD – Clevio LMS (Supabase, Next.js)
Tujuan

1. Menstandarkan operasional kelas coding Clevio (Weekly & Ekskul) end-to-end: kurikulum, penjadwalan, absensi, materi, rubrik, rapor, pitching day.
2. Mengurangi beban Coach: pengisian rubrik ringkas (A/B/C, soft-skill checklist), materi diatur Admin, coach hanya melengkapi catatan & nilai.
3. Meningkatkan visibilitas progres Coder & pelaporan ke orang tua (PDF otomatis saat Pitching Day via WhatsApp).
4. Memastikan keamanan & privasi: akses berbasis peran, minimal PII untuk Coach, audit trail lengkap.

Lingkup
• App web Next.js dengan Supabase (Auth, Postgres, Storage, Edge Functions).
• Integrasi WhatsApp via wweb.js (login QR di dashboard Admin).
• Tidak ada native mobile pada fase ini.
• Tidak ada integrasi pembayaran pada fase awal.

Peran & Persona
• Admin (kurikulum, kelas, jadwal, roster, user management, WA, laporan).
• Coach (mengajar, absensi, nilai/rubrik di akhir block untuk Weekly, materi tambahan relevan, catatan).
• Coder (siswa) (login username+password buatan Admin, akses materi yang sudah lewat, lihat “next block”, unggah tugas/make-up).
• Orang Tua (pasif; menerima PDF/WhatsApp, tidak login).

Definisi Kunci
• Level: EXPLORER, CREATOR, INNOVATOR (untuk Weekly).
• Block (Weekly): paket 16–20 pertemuan per topik (contoh: App Mobile 16x, Flutter 20x). Tiap block diakhiri Pitching Day.
• Lesson: unit materi dalam Block (Weekly).
• Session: satu pertemuan terjadwal (Zoom/Onsite), bisa terhubung ke ClassLesson.
• Weekly: kelas berbasis Block; Coder boleh bergabung di tengah; untuk lulus level harus menyelesaikan semua block (wrap-around ke block yang belum selesai).
• Ekskul: kelas by semester sesuai jadwal sekolah, tidak memakai Block; rubrik Ekskul per kompetensi per sesi/tema.
• Rubrik Weekly: aspek teknis per level + Positive Character (Coach centang 3 yang paling menonjol).
• Rubrik Ekskul: rubric set yang Anda berikan (Intro to Coding I/II, 3D/PC/Mobile, dsb).
• Rapor: per block (Weekly) dan per semester (ringkasan), PDF untuk orang tua saat Pitching Day.
• Materi: diberikan bertahap oleh Admin; Coach boleh unggah materi tambahan dengan catatan relevansi (lesson saat ini).
• Absensi: status hadir/terlambat/izin/alpa. Jika alpa/izin, sistem buat make-up task + notifikasi upload.

Use Case Utama

Admin

1. Kurikulum (Weekly): kelola BlockTemplate & LessonTemplate per level; publish/unpublish; re-order.
2. Perencanaan Kelas (Weekly): instansiasi template ke ClassBlock & ClassLesson, atur jadwal Session, tandai Pitching Day.
3. Perencanaan Kelas (Ekskul): buat kelas semesteran, jadwalkan Session; map kompetensi/lesson ekskul per sesi.
4. Rostering: tambah Coder ke kelas, assign Coach, pindah kelas, batasi kapasitas.
5. User Management: buat akun (Coder/Coach), username unik & immutable; reset password; nonaktifkan akun.
6. Materi: unggah materi ke Storage; atur progressive release (unlock setelah session lewat).
7. WhatsApp: login wweb.js, kelola template pesan (reminder, ketidakhadiran, pitching day, kirim PDF rapor).
8. Coach Leave: approve pengajuan izin (H-7), verifikasi coach pengganti, set akses sementara untuk sesi itu.
9. Laporan: generate dan kirim PDF rapor setelah Pitching Day; dashboard progres per kelas/level.

Coach

1. Lihat daftar kelas yang diajar; upcoming “next block” per kelas (ringkas: nama block, jumlah pertemuan, tanggal mulai/akhir).
2. Absensi per session; nilai cepat (A/B/C) ketika diperlukan; rubrik Weekly hanya di akhir block.
3. Unggah materi tambahan dengan catatan relevansi.
4. Catatan Coach per sesi (opsional).
5. Jika menggantikan Coach: hanya dapat akses sesi hari itu (absen+nilai).

Coder

1. Login username+password (dibuat Admin); ubah password & data pribadi terbatas (no change username).
2. Lihat materi yang sudah lewat sesuai jadwal; tidak bisa akses materi yang belum waktunya.
3. Lihat “Up Next” berupa block berikutnya saja (bukan seluruh jadwal).
4. Jika absen: terima instruksi make-up; unggah bukti: gambar/video/file game.
5. Lihat rapor block per semester (read-only).

Alur Khusus

A. Coder masuk di tengah level (Weekly)
• Sistem tandai block yang sudah/ belum ditempuh di level-nya.
• Setelah mencapai block terakhir terjadwal, sistem arahkan ke block awal yang belum complete hingga semua block required complete.
• Complete criteria block: hadir minimal X% sesi (atau make-up accepted), rubrik block terisi, pitching day submit dan present.

B. Pitching Day (Weekly)
• Setelah sesi pitching day ditandai done, Admin/Coach klik “Generate Report” → Edge Function render PDF (logo, ringkasan absensi, nilai rubrik, pilihan 3 Positive Character, deskripsi proyek).
• Admin kirim PDF ke orang tua via WhatsApp template yang sudah disiapkan.

C. Ketidakhadiran Coder
• Coach tandai Absent/Excused → sistem buat Make-up Task dengan instruksi default dari Lesson + checklist upload (gambar/video/file).
• Notifikasi ke Coder (WA) dan orang tua (opsional, bisa diaktifkan per kelas).
• Coach verifikasi submission → status make-up: approved/revise.

D. Izin Coach & Pengganti
• Coach isi form izin (H-7) & pilih pengganti (harus sudah user Coach).
• Admin approve → sistem set `session.coachUserId` ke coach pengganti untuk tanggal itu + berikan akses terbatas (absen+nilai, read-only materi).
• Jadwal kelas tidak berubah; notifikasi ke peserta.

Kebutuhan Fungsional

1. Auth & Akun
   • Supabase Auth. Username unik disimpan di `profiles.username` (unique).
   • Login Coder & Coach menggunakan username+password: Edge Function `authUsernameLogin` memetakan username → auth user id → verifikasi password Supabase.
   • Admin-only: buat user (service role), set username, role, password awal; reset password; disable user.
   • Coder boleh: ubah password & data pribadi dasar (display name, avatar). Username immutable.
   • Lupa password: hanya Admin yang bisa reset.

2. RBAC & RLS
   • Roles: ADMIN, COACH, CODER.
   • RLS ketat:
   – CODER hanya dapat row miliknya (enrolment, attendance, submissions, rapor).
   – COACH hanya untuk kelas yang di-assign; akses minimal PII (nama depan + inisial, no kontak/email tersembunyi).
   – COACH pengganti: akses terbatas ke session hari-H saja.
   – ADMIN: full access.

3. Kurikulum Weekly
   • Admin CRUD BlockTemplate(level, required, urutan) dan LessonTemplate.
   • Instansiasi ke ClassBlock & ClassLesson per Class.
   • Tandai pitching day session.
   • Progressive release materi (unlock pada `session.startDateTime` + offset).

4. Ekskul
   • Tidak pakai Block; jadwalkan Session by semester.
   • Map kompetensi per sesi (optional template).
   • Rubrik pakai set Ekskul (dari dokumen Anda).

5. Absensi & Penilaian
   • Absensi per session: hadir/terlambat/izin/alpha, alasan.
   • Nilai harian sederhana (opsional) + attachment kecil (opsional).
   • Weekly: rubrik diisi hanya pada akhir block (A/B/C per aspek), Positive Character pilih 3.
   • Ekskul: rubrik sesuai kompetensi list yang Anda sediakan.
   • Validasi: rubrik block hanya muncul pada sesi pitching day atau setelah block selesai.

6. Materi & Submission
   • Materi Admin (wajib) & Materi tambahan Coach (opsional, wajib isi catatan relevansi).
   • Storage buckets: `materials/`, `supplemental/`, `submissions/`, `reports/`.
   • Submission types: image/video/zip link/game file; validasi ukuran/jenis.

7. Notifikasi WhatsApp
   • Admin login WA (wweb.js) di dashboard.
   • Template: reminder kelas, absen & make-up, pitching day invite, kirim rapor PDF.
   • Batasi rate; log pengiriman; handle session renewal.

8. Laporan & PDF
   • Generate PDF rapor block (Weekly) & ringkasan semester (Ekskul).
   • Branding Clevio; data: identitas siswa (minimum), ringkasan absensi, rubrik, 3 Positive Character, highlight proyek/pitch.
   • Simpan ke Storage & tautkan di histori siswa.

9. Privasi & Audit
   • Coach tidak dapat melihat kontak/PII orang tua atau data personal lain di luar kebutuhan kelas.
   • Semua tindakan penting tercatat di audit log.

10. Ketersediaan & Performa
    • Target TTFB < 500ms untuk dashboard; generate PDF < 10s.
    • Backups DB harian Supabase; retensi 14 hari minimum.

Skema Data (Postgres, Supabase)

Catatan: tipe `uuid` refer ke `auth.users.id`. Semua tabel di schema publik dengan RLS diaktifkan. Field umum: `created_at timestamptz default now()`, `updated_at timestamptz default now()` via trigger.

Autentikasi & Profil

* auth.users (bawaan Supabase)
* profiles
  • id uuid PK references auth.users
  • username text unique not null
  • role text check in (‘ADMIN’, ‘COACH’, ‘CODER’) not null
  • display_name text
  • first_name text
  • last_name text
  • avatar_url text
  • pii_mask_level int default 1  (1: low exposure)

Kelas & Kurikulum

* levels
  • id uuid PK
  • code text unique (EXPLORER/CREATOR/INNOVATOR)
  • name text

* block_templates (Weekly)
  • id uuid PK
  • level_id uuid references levels
  • title text
  • sequence_number int
  • default_total_sessions int
  • is_required boolean default true
  • competencies text[]
  • is_published boolean default false

* lesson_templates
  • id uuid PK
  • block_template_id uuid references block_templates
  • sequence_number int
  • title text
  • objectives text
  • materials jsonb default ‘[]’  (array URL + label)
  • expected_competencies text[]

* classes
  • id uuid PK
  • type text check in (‘WEEKLY’, ‘EKSKUL’)
  • level_id uuid nullable for EKSKUL
  • name text
  • school_term text  (untuk Ekskul, contoh “2025-1”)
  • meeting_mode text check in (‘ZOOM’, ‘ONSITE’, ‘HYBRID’) default ‘ZOOM’
  • zoom_link text
  • is_active boolean default true

* class_blocks (instansiasi Weekly)
  • id uuid PK
  • class_id uuid references classes
  • template_id uuid references block_templates
  • title text
  • sequence_number int
  • total_sessions_planned int
  • is_required boolean default true

* class_lessons (instansiasi Weekly)
  • id uuid PK
  • class_block_id uuid references class_blocks
  • class_id uuid references classes
  • template_id uuid references lesson_templates
  • sequence_number int
  • title text
  • objectives text
  • materials jsonb
  • expected_competencies text[]

* sessions
  • id uuid PK
  • class_id uuid references classes
  • class_lesson_id uuid nullable references class_lessons
  • start_at timestamptz
  • duration_minutes int
  • delivery_mode text
  • coach_user_id uuid references auth.users
  • is_pitching_day boolean default false
  • cancelled boolean default false
  • coach_notes text

Rostering & Akses

* class_enrolments
  • id uuid PK
  • class_id uuid references classes
  • coder_user_id uuid references auth.users
  • status text check in (‘ACTIVE’, ‘DROPPED’, ‘COMPLETED’) default ‘ACTIVE’
  • joined_at timestamptz
  • left_at timestamptz

* coach_assignments
  • id uuid PK
  • class_id uuid references classes
  • coach_user_id uuid references auth.users
  • is_primary boolean default true

* coach_substitutions
  • id uuid PK
  • session_id uuid references sessions
  • original_coach_id uuid references auth.users
  • substitute_coach_id uuid references auth.users
  • requested_by uuid references auth.users
  • requested_at timestamptz
  • reason text
  • approved_by uuid references auth.users
  • approved_at timestamptz

Absensi & Penilaian

* attendance
  • id uuid PK
  • session_id uuid references sessions
  • coder_user_id uuid references auth.users
  • status text check in (‘PRESENT’, ‘LATE’, ‘EXCUSED’, ‘ABSENT’)
  • reason text
  • marked_by uuid references auth.users
  • marked_at timestamptz

* grades_daily (opsional)
  • id uuid PK
  • session_id uuid references sessions
  • coder_user_id uuid references auth.users
  • grade text  (A/B/C)
  • notes text

Rubrik Weekly

* rubric_weekly_aspects
  • id uuid PK
  • level_id uuid references levels
  • aspect_code text  (CONCEPT, CREATIVITY, DEBUGGING, TECH)
  • aspect_name text

* rubric_weekly_levels
  • id uuid PK
  • level_id uuid references levels
  • grade text check in (‘A’, ‘B’, ‘C’)
  • aspect_code text
  • good text
  • improve text

* positive_character_options
  • id uuid PK
  • code text unique (GRIT, SOCIAL_INTELLIGENCE, SELF_CONTROL, LEADERSHIP, CREATIVITY)
  • label text
  • description text

* rubric_weekly_results
  • id uuid PK
  • class_block_id uuid references class_blocks
  • coder_user_id uuid references auth.users
  • filled_by uuid references auth.users
  • filled_at timestamptz

* rubric_weekly_result_items
  • id uuid PK
  • result_id uuid references rubric_weekly_results
  • aspect_code text
  • grade text check in (‘A’, ‘B’, ‘C’)
  • auto_good text
  • auto_improve text

* rubric_weekly_result_characters
  • id uuid PK
  • result_id uuid references rubric_weekly_results
  • character_code text

Rubrik Ekskul

* rubric_exkul_templates
  • id uuid PK
  • track_code text  (INTRO_CODING_I, 3D_BEGINNER, PC_PBL, dll)
  • competency text
  • grade text check in (‘A’, ‘B’, ‘C’)
  • good text
  • improve text

* rubric_exkul_results
  • id uuid PK
  • class_id uuid references classes
  • session_id uuid references sessions nullable
  • coder_user_id uuid references auth.users
  • track_code text
  • competency text
  • grade text
  • auto_good text
  • auto_improve text
  • filled_by uuid references auth.users
  • filled_at timestamptz

Materi & Tugas

* materials (admin)
  • id uuid PK
  • class_lesson_id uuid nullable
  • class_id uuid references classes
  • title text
  • file_path text (Storage)
  • unlock_at timestamptz  (biasanya = session.start_at)
  • is_required boolean default true

* materials_coach_extra
  • id uuid PK
  • class_id uuid references classes
  • session_id uuid references sessions
  • coach_user_id uuid references auth.users
  • title text
  • note_relevance text
  • file_path text

* makeups
  • id uuid PK
  • session_id uuid references sessions
  • coder_user_id uuid references auth.users
  • instructions text
  • status text check in (‘OPEN’, ‘SUBMITTED’, ‘APPROVED’, ‘REVISION’) default ‘OPEN’
  • notified_at timestamptz

* submissions
  • id uuid PK
  • makeup_id uuid nullable references makeups
  • session_id uuid references sessions
  • coder_user_id uuid references auth.users
  • file_path text
  • file_type text
  • notes text
  • reviewed_by uuid references auth.users
  • reviewed_at timestamptz
  • verdict text check in (‘APPROVED’, ‘REVISION’, ‘INFO’)

Rapor & WhatsApp

* reports
  • id uuid PK
  • class_block_id uuid nullable
  • class_id uuid references classes
  • coder_user_id uuid references auth.users
  • pdf_path text
  • generated_at timestamptz
  • generated_by uuid references auth.users

* wa_accounts
  • id uuid PK
  • admin_user_id uuid references auth.users
  • session_label text
  • status text check in (‘DISCONNECTED’, ‘CONNECTED’)
  • last_connected_at timestamptz

* wa_messages
  • id uuid PK
  • wa_account_id uuid references wa_accounts
  • recipient text  (no. WA masked di UI)
  • template_code text
  • payload jsonb
  • sent_at timestamptz
  • status text check in (‘QUEUED’, ‘SENT’, ‘FAILED’)
  • error text

Audit

* audit_logs
  • id uuid PK
  • actor uuid references auth.users
  • action text
  • entity text
  • entity_id text
  • metadata jsonb
  • at timestamptz default now()

RLS Garis Besar (pseudo)
• profiles: user hanya SELECT dirinya; ADMIN bisa SELECT semua.
• classes: COACH hanya kelas yang dia assigned; CODER hanya kelas yang dia enrol.
• sessions: COACH hanya sesi kelasnya + sesi pengganti; CODER sesi kelasnya.
• attendance: COACH kelasnya; CODER baris miliknya; ADMIN semua.
• materials: CODER hanya yang `unlock_at <= now()` dan kelasnya sendiri; COACH kelasnya.
• submissions & makeups: CODER miliknya; COACH kelasnya.
• rubric_weekly_results/items: COACH kelasnya; CODER hanya miliknya (read).
• reports: CODER miliknya; COACH kelasnya (read); ADMIN semua.
• wa_*: hanya ADMIN.

Edge Functions (Supabase)

1. authUsernameLogin(username, password)
   – map `profiles.username` → auth user id → `signInWithPassword` internal → return session JWT.
2. adminCreateUser(payload) [service role]
   – buat auth user (email dummy `{username}@clevio.local`), set password, insert profile + role + username unik.
3. adminResetPassword(user_id, newPassword) [service role]
4. generateReportPDF(coder_id, class_block_id | class_id)
   – compile data → render React-PDF → simpan ke `reports/` → return path.
5. notifyWhatsApp(template_code, to, payload)
   – mengantrikan ke tabel `wa_messages` & worker Node (wweb.js) yang mengambil antrian.

Integrasi WhatsApp (wweb.js)
• Worker Node.js (separate process atau Next.js route handler dengan long-running).
• Admin login QR dari dashboard → simpan sesi terenkripsi.
• Pesan siap pakai:
– SESSION_REMINDER (H-1/H-0).
– ABSENCE_NOTICE (siswa/ortu).
– MAKEUP_TASK.
– PITCHING_DAY_INVITE.
– REPORT_DELIVERY (lampirkan link signed URL PDF).
• Rate limit & retry; log ke `wa_messages`.

UI/UX Ringkas

Admin
• Curriculum Library: manage BlockTemplate/LessonTemplate (drag-drop, publish).
• Class Planner: instantiate template, set jadwal, tandai Pitching Day.
• Rostering: tambah/lepaskan coder, assign coach.
• WhatsApp: status koneksi, kirim broadcast terpilih.
• Reports: filter kelas/block; generate batch PDF.
• Users: create/reset/disable.
• Audit: timeline tindakan.

Coach
• Home: daftar kelas (upcoming “next block” ringkas).
• Session Detail: absensi cepat, materi, submission list, catatan Coach.
• Rubrik: wizard di akhir block (Weekly) atau form Ekskul per kompetensi.
• Upload materi tambahan + catatan relevansi.

Coder
• Home: “Up Next: [Block name]” + tanggal mulai block berikutnya.
• Materi: list materi yang sudah unlock sesuai jadwal.
• Make-up: daftar tugas pending, tombol upload.
• Rapor: daftar rapor PDF per block/semester.

Behavior Kunci

Progressive Release
• Trigger/cron per 5 menit set `materials.unlock_at <= now()` → tampil untuk Coder.
• Untuk kelas dengan reschedule minor, Admin dapat override unlock_at.

Wrap-around Level Completion (Weekly)
• View “My Level Progress”: daftar semua required block untuk level → status complete/pending.
• Setelah block terakhir terjadwal, Planner Admin memastikan rotasi ke block pending; sistem bantu rekomendasi.

Coach Rubrik Weekly
• Hanya tampil pada akhir block (Pitching Day) atau ketika Admin “Open Rubric Now”.
• Form: A/B/C per aspek; auto-generate kalimat Good/Improve dari template; Positive Character: pilih tepat 3.

Ekskul Rubrik
• Dropdown track/kompetensi → pilih nilai A/B/C → auto teks Good/Improve dari template.

Notifikasi Ketidakhadiran
• Saat Coach tandai ABSENT/EXCUSED, otomatis buat Make-up task & kirim WA template ke Coder (+ortu opsional).
• SLA default: 7 hari; reminder H-3 & H-1 bila belum submit.

Data Privasi Coach
• Coach melihat: nama panggilan siswa, foto avatar opsional, usia kisaran (opsional), histori akademik ringkas dalam ekosistem Clevio (progress block & rapor ringkasan) TANPA kontak/nomor orang tua, alamat, email, dsb.
• Semua kontak orang tua hanya terlihat Admin.

Acceptance Criteria (contoh)

1. Coder hanya melihat materi dengan `unlock_at` lampau.
2. “Up Next” menampilkan satu block berikutnya (judul, estimasi pertemuan, window tanggal), bukan seluruh kalender.
3. Coach dapat unggah materi tambahan dengan catatan, dan tercatat di audit.
4. Rubrik Weekly hanya bisa disubmit pada akhir block; Positive Character harus tepat 3 pilihan.
5. Ketika Coder absen, Make-up task tercipta otomatis, notifikasi WA terkirim, dan submission dapat di-review.
6. Coach pengganti hanya bisa akses sesi yang disubstitusi.
7. Admin bisa membuat user baru (username unik) dan mereset password; Coder tidak bisa mengubah username.
8. PDF rapor dapat diunduh & terkirim ke WA orang tua pada hari Pitching Day.
9. RLS mencegah Coach mengakses PII siswa di luar kebutuhan kelasnya.

Non-Fungsional
• Keamanan: RLS on; Edge Functions service role dikunci; storage signed URL 24 jam; audit log untuk semua aksi sensitif.
• Kinerja: halaman utama < 1s di koneksi normal; query diindex (sessions.class_id, attendance.session_id, rubric foreign keys).
• Backup & DR: backup otomatis Supabase harian; export Storage mingguan.
• Observabilitas: logs Edge Functions, worker WA, dan metrik query.
• Akses admin route tersembunyi: tidak ditautkan publik; opsional IP allowlist atau env-guard.

Contoh RLS Policy (pseudo-SQL)

* CODER melihat attendance miliknya:

```
create policy "coder_can_select_own_attendance"
on attendance for select
to authenticated
using (coder_user_id = auth.uid());
```

* COACH melihat attendance kelasnya:

```
create policy "coach_can_select_class_attendance"
on attendance for select
to authenticated
using (
  exists (
    select 1 from coach_assignments ca
    where ca.class_id = attendance.session_id::uuid in
      (select s.class_id from sessions s where s.id = attendance.session_id)
    and ca.coach_user_id = auth.uid()
  )
  or exists (
    select 1 from coach_substitutions cs
    join sessions s on s.id = cs.session_id
    where cs.substitute_coach_id = auth.uid()
      and cs.session_id = attendance.session_id
  )
);
```

(Implementasi final akan disesuaikan agar valid Postgres; ini garis besar logikanya.)

API (Next.js Route Handler contoh)
• POST /api/admin/users  → adminCreateUser
• POST /api/admin/users/:id/reset-password
• POST /api/auth/username-login
• POST /api/reports/generate
• POST /api/wa/send
• POST /api/classes/:id/instantiate-weekly
• POST /api/sessions/:id/attendance
• POST /api/sessions/:id/makeup
• POST /api/rubrics/weekly/submit
• POST /api/rubrics/exkul/submit

Storage Buckets & Kebijakan
• materials: public read via signed URL setelah unlock; upload Admin.
• supplemental: read oleh enrollee & coach kelas; upload Coach.
• submissions: read owner + coach kelas + admin; upload Coder.
• reports: read owner + admin; link WA via signed URL.

Seed Data Minimal
• levels (EXPLORER/CREATOR/INNOVATOR).
• positive_character_options (GRIT, SOCIAL_INTELLIGENCE, SELF_CONTROL, LEADERSHIP, CREATIVITY).
• rubric_weekly_aspects + rubric_weekly_levels (template dari rubrik Weekly Anda).
• rubric_exkul_templates (dari daftar Ekskul Anda; dapat diimpor via CSV).

Risiko & Mitigasi
• Login via username di Supabase (email-first): gunakan email dummy {username}@clevio.local atau mapping via Edge Function.
• Stabilitas WA (wweb.js): jalankan worker terpisah, auto-reconnect, simpan sesi terenkripsi, throttle.
• Beban Coach: rubrik Weekly di akhir block saja; UI wizard cepat; auto-teks.
• Coder masuk di tengah: tampilkan “remaining blocks” jelas; Admin Planner dibantu rekomendasi rotasi.

Roadmap Fase
F1 (MVP): Auth, Class Weekly Planner, Absensi, Materi unlock, Rubrik Weekly & PDF, WA kirim rapor, Wrap-around progress.
F2: Ekskul penuh (rubrik ekskul, mapping kompetensi per sesi), Make-up workflow lengkap.
F3: Dashboard analitik, batch reporting, import/export kurikulum, notifikasi otomatis lengkap.

Selesai. Kalau sudah pas, bilang “bikin sekarang” dan saya langsung turunkan jadi file `prd.md` beserta skema SQL awal (DDL) dan stub Edge Functions. Setelah itu, saya lanjutkan `agents.md` untuk Next.js + Supabase (routing, server actions, dan worker WA).

