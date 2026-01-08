-- Rubric-focused sample data for Supabase
-- Jalankan setelah `supabase_schema.sql`. Direkomendasikan juga sudah menjalankan `supabase_sample_data.sql`
-- agar block & lesson template dasar terisi.

begin;

---------------------------------------------
-- 1. Level standar (EXPLORER/CREATOR/INNOVATOR)
---------------------------------------------
insert into levels (name, description, order_index)
values
  ('EXPLORER', 'Level weekly awal untuk coder baru.', 0),
  ('CREATOR', 'Level intermediate untuk coder lanjutan.', 1),
  ('INNOVATOR', 'Level advanced untuk persiapan pitching.', 2)
on conflict (name) do update set description = excluded.description;

---------------------------------------------
-- 2. Users: admin, coach, coder
---------------------------------------------
insert into users (username, password_hash, full_name, role, parent_contact_phone)
values
  ('admin.clevio', crypt('Admin123!', gen_salt('bf')), 'Admin Clevio', 'ADMIN', null),
  ('coach.ari', crypt('Coach123!', gen_salt('bf')), 'Coach Ari Pratama', 'COACH', null),
  ('coder.nara', crypt('Coder123!', gen_salt('bf')), 'Nara Pratama', 'CODER', '+628111234567'),
  ('coder.siti', crypt('Coder123!', gen_salt('bf')), 'Siti Rahma', 'CODER', '+628129876543')
on conflict (username) do update set full_name = excluded.full_name
returning username;

---------------------------------------------
-- 3. Block Weekly level Explorer (jika belum ada)
---------------------------------------------
with lvl as (
  select id from levels where name = 'EXPLORER'
)
insert into blocks (level_id, name, summary, order_index, estimated_sessions, is_published)
select lvl.id, block_name, summary, order_idx, sessions, true
from lvl
cross join (
  values
    ('Explorer Block: Game Intro', 'Fundamental gameplay & storytelling untuk pitching day perdana.', 0, 8),
    ('Explorer Block: Story Quest', 'Eksplorasi storytelling interaktif dengan conditional logic.', 1, 8)
) as data(block_name, summary, order_idx, sessions)
on conflict (level_id, name) do update set summary = excluded.summary;

---------------------------------------------
-- 4. Rubric template Weekly (level Explorer)
---------------------------------------------
with lvl as (
  select id from levels where name = 'EXPLORER'
),
admin_user as (
  select id from users where username = 'admin.clevio'
)
insert into rubric_templates (class_type, level_id, competencies, positive_characters, created_by)
select
  'WEEKLY',
  lvl.id,
  jsonb_build_object(
    'technical_execution',
      jsonb_build_object(
        'label', 'Technical Execution',
        'descriptions', jsonb_build_object(
          'A', 'Menerapkan konsep coding block secara mandiri dan minim bug.',
          'B', 'Menerapkan konsep utama namun masih perlu arahan untuk debugging.',
          'C', 'Masih kesulitan menerapkan konsep dasar dan sering bergantung pada coach.'
        )
      ),
    'project_creativity',
      jsonb_build_object(
        'label', 'Project Creativity',
        'descriptions', jsonb_build_object(
          'A', 'Proyek menunjukkan ide orisinal, variasi fitur, dan polish visual/audio.',
          'B', 'Ide jelas namun variasi fitur masih terbatas atau polish belum konsisten.',
          'C', 'Proyek belum menunjukkan diferensiasi; masih menyerupai template dasar.'
        )
      ),
    'presentation',
      jsonb_build_object(
        'label', 'Pitching & Communication',
        'descriptions', jsonb_build_object(
          'A', 'Presentasi runtut, percaya diri, mampu menjawab pertanyaan dengan tepat.',
          'B', 'Penjelasan cukup runtut namun masih bergantung pada cue coach atau catatan.',
          'C', 'Masih kesulitan menjelaskan ide & alur proyek ke audiens.'
        )
      )
  ),
  array['GRIT', 'SOCIAL_INTELLIGENCE', 'SELF_CONTROL', 'LEADERSHIP', 'CREATIVITY'],
  admin_user.id
from lvl, admin_user
where not exists (
  select 1 from rubric_templates
  where class_type = 'WEEKLY' and level_id = lvl.id
);

---------------------------------------------
-- 5. Rubric template Ekskul (tanpa level spesifik)
---------------------------------------------
with admin_user as (
  select id from users where username = 'admin.clevio'
)
insert into rubric_templates (class_type, level_id, competencies, positive_characters, created_by)
select
  'EKSKUL',
  null,
  jsonb_build_object(
    'participation',
      jsonb_build_object(
        'label', 'Partisipasi & Antusias',
        'descriptions', jsonb_build_object(
          'A', 'Aktif bertanya/berbagi ide, membantu teman lain, hadir penuh.',
          'B', 'Cukup terlibat namun masih menunggu instruksi coach.',
          'C', 'Perlu dorongan untuk ikut serta atau sering tidak fokus.'
        )
      ),
    'skill_growth',
      jsonb_build_object(
        'label', 'Pertumbuhan Skill',
        'descriptions', jsonb_build_object(
          'A', 'Menguasai materi ekskul dan mampu menerapkan variasi teknik baru.',
          'B', 'Memahami materi utama namun masih butuh contoh tambahan.',
          'C', 'Masih kesulitan mengikuti materi inti sesi.'
        )
      ),
    'collaboration',
      jsonb_build_object(
        'label', 'Kolaborasi & Sikap',
        'descriptions', jsonb_build_object(
          'A', 'Selalu suportif, mendengarkan, dan menghargai pendapat teman.',
          'B', 'Bekerja sama dengan baik namun masih perlu diingatkan tentang role.',
          'C', 'Sering lupa giliran atau kurang menghargai kontribusi tim.'
        )
      )
  ),
  array['GRIT', 'SOCIAL_INTELLIGENCE', 'SELF_CONTROL', 'LEADERSHIP', 'CREATIVITY'],
  admin_user.id
from admin_user
where not exists (
  select 1 from rubric_templates
  where class_type = 'EKSKUL' and level_id is null
);

---------------------------------------------
-- 6. Weekly class sample + block aktif
---------------------------------------------
with lvl as (select id from levels where name = 'EXPLORER'),
coach as (select id from users where username = 'coach.ari')
insert into classes (name, type, level_id, coach_id, schedule_day, schedule_time, zoom_link, start_date, end_date)
select
  'Weekly Explorer Orbit',
  'WEEKLY',
  lvl.id,
  coach.id,
  'Sabtu',
  '10:00',
  'https://zoom.us/j/weekly-orbit',
  '2025-01-11',
  '2025-04-26'
from lvl, coach
where not exists (
  select 1 from classes where name = 'Weekly Explorer Orbit'
);

with klass as (select id, zoom_link from classes where name = 'Weekly Explorer Orbit'),
block as (select id from blocks where name = 'Explorer Block: Game Intro')
insert into class_blocks (class_id, block_id, status, start_date, end_date, pitching_day_date)
select
  klass.id,
  block.id,
  'CURRENT',
  '2025-01-11',
  '2025-03-29',
  '2025-03-29'
from klass, block
on conflict (class_id, block_id) do update
set status = excluded.status,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    pitching_day_date = excluded.pitching_day_date;

-- sesi contoh untuk kelas weekly
with klass as (select id, zoom_link from classes where name = 'Weekly Explorer Orbit')
insert into sessions (class_id, date_time, zoom_link_snapshot, status)
select klass.id, session_time, klass.zoom_link, status
from klass
cross join (
  values
    (timestamptz '2025-03-08 10:00+07', 'SCHEDULED'),
    (timestamptz '2025-03-15 10:00+07', 'SCHEDULED'),
    (timestamptz '2025-03-29 10:00+07', 'SCHEDULED')
) as data(session_time, status)
where not exists (
  select 1 from sessions
  where class_id = klass.id and date_time = data.session_time
);

---------------------------------------------
-- 7. Ekskul class sample
---------------------------------------------
with coach as (select id from users where username = 'coach.ari')
insert into classes (name, type, level_id, coach_id, schedule_day, schedule_time, zoom_link, start_date, end_date)
select
  'Ekskul Robotics Friday',
  'EKSKUL',
  null,
  coach.id,
  'Jumat',
  '16:00',
  'https://zoom.us/j/exkul-robotics',
  '2025-02-07',
  '2025-06-20'
from coach
where not exists (
  select 1 from classes where name = 'Ekskul Robotics Friday'
);

with klass as (select id, zoom_link from classes where name = 'Ekskul Robotics Friday')
insert into sessions (class_id, date_time, zoom_link_snapshot, status)
select klass.id, session_time, klass.zoom_link, status
from klass
cross join (
  values
    (timestamptz '2025-03-07 16:00+07', 'SCHEDULED'),
    (timestamptz '2025-03-14 16:00+07', 'SCHEDULED')
) as data(session_time, status)
where not exists (
  select 1 from sessions
  where class_id = klass.id and date_time = data.session_time
);

---------------------------------------------
-- 8. Enroll coder ke kelas weekly + ekskul
---------------------------------------------
with weekly_class as (select id from classes where name = 'Weekly Explorer Orbit'),
exkul_class as (select id from classes where name = 'Ekskul Robotics Friday'),
coder_nara as (select id from users where username = 'coder.nara'),
coder_siti as (select id from users where username = 'coder.siti')
insert into enrollments (class_id, coder_id)
select class_id, coder_id
from (
  select weekly_class.id as class_id, coder_nara.id as coder_id from weekly_class, coder_nara
  union all
  select weekly_class.id, coder_siti.id from weekly_class, coder_siti
  union all
  select exkul_class.id, coder_nara.id from exkul_class, coder_nara
  union all
  select exkul_class.id, coder_siti.id from exkul_class, coder_siti
) as pairs
where not exists (
  select 1 from enrollments e
  where e.class_id = pairs.class_id and e.coder_id = pairs.coder_id
);

commit;

-- Setelah menjalankan script ini:
-- • Weekly rubric dapat diisi melalui /coach/rubrics/weekly/{classId__blockId} menggunakan block "Explorer Block: Game Intro".
-- • Ekskul rubric dapat diisi dengan memilih semester tag (contoh 2025-S1) pada kelas "Ekskul Robotics Friday".
