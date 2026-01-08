-- Sample curriculum data for existing levels Xplorer, Creator, Innovator
-- Run AFTER supabase_schema.sql and only if these levels already exist.

-- Helper: map level names to IDs. Script skips inserts if level missing.
with level_refs as (
  select name, id
  from levels
  where name in ('Xplorer', 'Creator', 'Innovator')
),

-- -------- XPLORER BLOCKS & LESSONS ------------------------------------------
explorer_level as (
  select id from level_refs where name = 'Xplorer'
),
explorer_blocks as (
  insert into blocks (level_id, name, summary, order_index, estimated_sessions, is_published)
  select explorer_level.id, block_name, summary, order_idx, sessions, true
  from explorer_level
  cross join (
    values
      ('Explorer Block 1: Discover', 'Kenali konsep dasar coding visual & koordinat.', 0, 4),
      ('Explorer Block 2: Storycraft', 'Buat cerita interaktif dengan logika percabangan.', 1, 4),
      ('Explorer Block 3: Mini Arcade', 'Bangun mini game dengan skor & kondisi menang.', 2, 5)
  ) as data(block_name, summary, order_idx, sessions)
  on conflict (level_id, name) do nothing
  returning id, name
),
explorer_lessons as (
  insert into lesson_templates (block_id, title, summary, slide_url, order_index, duration_minutes, make_up_instructions)
  select b.id, lesson_title, lesson_summary, lesson_slides, lesson_order, lesson_minutes, lesson_makeup
  from (
    select id, name
    from explorer_blocks
    union
    select id, name from blocks
    where level_id = (select id from explorer_level)
      and name in ('Explorer Block 1: Discover', 'Explorer Block 2: Storycraft', 'Explorer Block 3: Mini Arcade')
  ) as b
  join (
    values
      ('Explorer Block 1: Discover', 0, 'Memulai Proyek', 'Kenali antarmuka & jalankan project pertama.', 'https://slides.clev.io/explorer-discover-01', 45, 'Ikuti modul rekaman di LMS dan kirim screenshot.'),
      ('Explorer Block 1: Discover', 1, 'Gerak & Looping', 'Gunakan blok gerak & loop untuk animasi dasar.', 'https://slides.clev.io/explorer-discover-02', 60, 'Kirikan proyek animasi 10 detik.'),
      ('Explorer Block 1: Discover', 2, 'Efek & Suara', 'Tambahkan efek visual dan suara sederhana.', 'https://slides.clev.io/explorer-discover-03', 60, 'Pasang efek suara & share link projek.'),
      ('Explorer Block 2: Storycraft', 0, 'Struktur Cerita', 'Susun alur awal-tengah-akhir dengan storyboard.', 'https://slides.clev.io/explorer-story-01', 60, 'Lengkapi template storyboard.'),
      ('Explorer Block 2: Storycraft', 1, 'Dialog & Broadcast', 'Gunakan broadcast untuk percakapan interaktif.', 'https://slides.clev.io/explorer-story-02', 60, 'Tambahkan minimal dua percakapan dalam proyek.'),
      ('Explorer Block 2: Storycraft', 2, 'Transisi & Atmosfer', 'Pakai backdrop & soundscape untuk suasana.', 'https://slides.clev.io/explorer-story-03', 60, 'Upload video demo cerita lengkap.'),
      ('Explorer Block 3: Mini Arcade', 0, 'Mekanika Game', 'Definisikan objektif & kontrol.', 'https://slides.clev.io/explorer-arcade-01', 60, 'Submit rancangan mekanika game.'),
      ('Explorer Block 3: Mini Arcade', 1, 'Skor & Kondisi', 'Gunakan variabel & kondisi menang / kalah.', 'https://slides.clev.io/explorer-arcade-02', 75, 'Implementasikan skor dan kondisi restart.'),
      ('Explorer Block 3: Mini Arcade', 2, 'Playtest & Refinement', 'Uji permainan dan perbaiki feedback.', 'https://slides.clev.io/explorer-arcade-03', 60, 'Catat feedback playtester & update game.')
  ) as lessons(block_name, lesson_order, lesson_title, lesson_summary, lesson_slides, lesson_minutes, lesson_makeup)
    on conflict (block_id, order_index) do nothing
)
select 1 as applied_explorer
from explorer_lessons
limit 1;

-- -------- CREATOR BLOCKS & LESSONS ------------------------------------------
with level_refs as (
  select name, id
  from levels
  where name in ('Creator', 'Innovator')
),
creator_level as (
  select id from level_refs where name = 'Creator'
),
creator_blocks as (
  insert into blocks (level_id, name, summary, order_index, estimated_sessions, is_published)
  select creator_level.id, block_name, summary, order_idx, sessions, true
  from creator_level
  cross join (
    values
      ('Creator Block 1: Builder Lab', 'Desain dunia 3D & eksperimen mekanik blok.', 0, 4),
      ('Creator Block 2: Automation Studio', 'Bangun sistem otomatis & logika lanjutan.', 1, 4),
      ('Creator Block 3: Experience Design', 'Rancang pengalaman interaktif lengkap.', 2, 5)
  ) as data(block_name, summary, order_idx, sessions)
  on conflict (level_id, name) do nothing
  returning id, name
),
creator_lessons as (
  insert into lesson_templates (block_id, title, summary, slide_url, order_index, duration_minutes, make_up_instructions)
  select b.id, lesson_title, lesson_summary, lesson_slides, lesson_order, lesson_minutes, lesson_makeup
  from (
    select id, name
    from creator_blocks
    union
    select id, name from blocks
    where level_id = (select id from creator_level)
      and name in ('Creator Block 1: Builder Lab', 'Creator Block 2: Automation Studio', 'Creator Block 3: Experience Design')
  ) as b
  join (
    values
      ('Creator Block 1: Builder Lab', 0, 'Prototipe Cepat', 'Gunakan MVP canvas untuk merancang ide proyek.', 'https://slides.clev.io/creator-builder-01', 60, 'Isi lembar MVP dan upload foto.'),
      ('Creator Block 1: Builder Lab', 1, 'Tekstur & Material', 'Eksperimen dengan estetika dan tema.', 'https://slides.clev.io/creator-builder-02', 60, 'Kumpulkan referensi moodboard.'),
      ('Creator Block 1: Builder Lab', 2, 'Interaksi Dasar', 'Implementasikan interaksi click/touch.', 'https://slides.clev.io/creator-builder-03', 75, 'Tunjukkan prototype ke mentor.'),
      ('Creator Block 2: Automation Studio', 0, 'Rantai Otomasi', 'Gunakan sensor & trigger berantai.', 'https://slides.clev.io/creator-auto-01', 60, 'Kirim video otomasi minimal 3 langkah.'),
      ('Creator Block 2: Automation Studio', 1, 'Logika & Debugging', 'Analisis bug dan gunakan debug tools.', 'https://slides.clev.io/creator-auto-02', 75, 'Tulis laporan bug yang ditemukan.'),
      ('Creator Block 2: Automation Studio', 2, 'Integrasi UI', 'Hubungkan sistem dengan HUD/UX.', 'https://slides.clev.io/creator-auto-03', 60, 'Implementasikan indikator status pada UI.'),
      ('Creator Block 3: Experience Design', 0, 'Flow Pengguna', 'Desain jalur pengguna dari masuk hingga akhir.', 'https://slides.clev.io/creator-experience-01', 60, 'Buat diagram user flow.'),
      ('Creator Block 3: Experience Design', 1, 'Feedback & Reward', 'Tambahkan feedback audio/visual & reward loop.', 'https://slides.clev.io/creator-experience-02', 60, 'Susun daftar reward yang ada di game.'),
      ('Creator Block 3: Experience Design', 2, 'Pitch Deck', 'Siapkan presentasi akhir untuk showcase.', 'https://slides.clev.io/creator-experience-03', 60, 'Unggah pitch deck versi final.')
  ) as lessons(block_name, lesson_order, lesson_title, lesson_summary, lesson_slides, lesson_minutes, lesson_makeup)
    on conflict (block_id, order_index) do nothing
)
select 1 as applied_creator
from creator_lessons
limit 1;

-- -------- INNOVATOR BLOCKS & LESSONS ----------------------------------------
with level_refs as (
  select name, id
  from levels
  where name = 'Innovator'
),
innovator_level as (
  select id from level_refs where name = 'Innovator'
),
innovator_blocks as (
  insert into blocks (level_id, name, summary, order_index, estimated_sessions, is_published)
  select innovator_level.id, block_name, summary, order_idx, sessions, true
  from innovator_level
  cross join (
    values
      ('Innovator Block 1: Advanced Systems', 'Bangun sistem kompleks dengan scripting & data.', 0, 4),
      ('Innovator Block 2: Collaboration Sprint', 'Kolaborasi multi-player & integrasi API.', 1, 4),
      ('Innovator Block 3: Showcase Lab', 'Finalisasi dan rencana publikasi proyek.', 2, 5)
  ) as data(block_name, summary, order_idx, sessions)
  on conflict (level_id, name) do nothing
  returning id, name
),
innovator_lessons as (
  insert into lesson_templates (block_id, title, summary, slide_url, order_index, duration_minutes, make_up_instructions)
  select b.id, lesson_title, lesson_summary, lesson_slides, lesson_order, lesson_minutes, lesson_makeup
  from (
    select id, name
    from innovator_blocks
    union
    select id, name from blocks
    where level_id = (select id from innovator_level)
      and name in ('Innovator Block 1: Advanced Systems', 'Innovator Block 2: Collaboration Sprint', 'Innovator Block 3: Showcase Lab')
  ) as b
  join (
    values
      ('Innovator Block 1: Advanced Systems', 0, 'Data Flow', 'Gunakan data store & event asinkron.', 'https://slides.clev.io/innovator-advanced-01', 75, 'Rancang flowchart data lengkap.'),
      ('Innovator Block 1: Advanced Systems', 1, 'Modular Architecture', 'Pisahkan logic ke modul & service.', 'https://slides.clev.io/innovator-advanced-02', 75, 'Refactor script ke modul terpisah.'),
      ('Innovator Block 1: Advanced Systems', 2, 'Testing & Telemetry', 'Bangun sistem logging & analytics sederhana.', 'https://slides.clev.io/innovator-advanced-03', 60, 'Pasang logging dan kirim laporan hasil test.'),
      ('Innovator Block 2: Collaboration Sprint', 0, 'Version Control', 'Gunakan Git / Version history untuk kolaborasi.', 'https://slides.clev.io/innovator-collab-01', 60, 'Upload bukti commit kolaboratif.'),
      ('Innovator Block 2: Collaboration Sprint', 1, 'Team Workflow', 'Terapkan agile board & task assignment.', 'https://slides.clev.io/innovator-collab-02', 60, 'Tunjukkan board tugas sprint.'),
      ('Innovator Block 2: Collaboration Sprint', 2, 'Network Integration', 'Bangun fitur multi-player atau API eksternal.', 'https://slides.clev.io/innovator-collab-03', 75, 'Demo fitur kolaborasi via video.'),
      ('Innovator Block 3: Showcase Lab', 0, 'Final Polish', 'Optimasi performa & UI/UX.', 'https://slides.clev.io/innovator-showcase-01', 60, 'Catat perubahan final dalam changelog.'),
      ('Innovator Block 3: Showcase Lab', 1, 'Publishing Strategy', 'Pahami syarat publishing & monetisasi lanjutan.', 'https://slides.clev.io/innovator-showcase-02', 60, 'Susun rencana rilis & monetisasi.'),
      ('Innovator Block 3: Showcase Lab', 2, 'Pitch Presentation', 'Latihan pitching & Q&A simulasi.', 'https://slides.clev.io/innovator-showcase-03', 60, 'Rekam presentasi latihan dan submit link.')
  ) as lessons(block_name, lesson_order, lesson_title, lesson_summary, lesson_slides, lesson_minutes, lesson_makeup)
    on conflict (block_id, order_index) do nothing
)
select 1 as applied_innovator
from innovator_lessons
limit 1;
