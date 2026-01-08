-- Sample data focusing on an Ekskul class that meets today.
-- Jalankan setelah `supabase_schema.sql`. Script ini tidak menambah data pada tabel `levels`.

begin;

---------------------------------------------
-- 1. Users (admin, coach, coders) ----------
---------------------------------------------
with upserted as (
  insert into users (username, password_hash, full_name, role, parent_contact_phone)
  values
    ('admin.today', crypt('AdminToday#1', gen_salt('bf')), 'Admin Today', 'ADMIN', null),
    ('coach.nadia', crypt('CoachToday#1', gen_salt('bf')), 'Coach Nadia Prameswari', 'COACH', null),
    ('coder.farrel', crypt('CoderToday#1', gen_salt('bf')), 'Farrel Wijaya', 'CODER', '+6281234567890'),
    ('coder.salma', crypt('CoderToday#1', gen_salt('bf')), 'Salma Putri', 'CODER', '+6289876543210')
  on conflict (username) do nothing
  returning username, id
)
select * from upserted;

---------------------------------------------
-- 2. Ekskul class scheduled for today ------
---------------------------------------------
with coach as (
  select id from users where username = 'coach.nadia'
),
insert_class as (
  insert into classes (
    name,
    type,
    level_id,
    coach_id,
    schedule_day,
    schedule_time,
    zoom_link,
    start_date,
    end_date
  )
  select
    'Ekskul Design Sprint - Jumat',
    'EKSKUL'::class_type_enum,
    null,
    coach.id,
    'Jumat',
    (current_time)::time,
    'https://zoom.example.com/eks-design-sprint',
    current_date,
    current_date + interval '45 day'
  from coach
  where not exists (
    select 1 from classes where name = 'Ekskul Design Sprint - Jumat'
  )
  returning id
),
cls as (
  select id from insert_class
  union all
  select id from classes where name = 'Ekskul Design Sprint - Jumat'
)
select id from cls;

---------------------------------------------
-- 3. Sessions (today + upcoming) -----------
---------------------------------------------
with cls as (
  select id, zoom_link from classes where name = 'Ekskul Design Sprint - Jumat'
),
ins as (
  insert into sessions (class_id, date_time, zoom_link_snapshot, status)
  select
    cls.id,
    date_trunc('day', now()) + time '15:00',
    cls.zoom_link,
    'SCHEDULED'::session_status_enum
  from cls
  where not exists (
    select 1 from sessions where class_id = cls.id and date_trunc('day', date_time) = date_trunc('day', now())
  )
  returning id, class_id, date_time
)
select * from ins;

with cls as (
  select id, zoom_link from classes where name = 'Ekskul Design Sprint - Jumat'
)
insert into sessions (class_id, date_time, zoom_link_snapshot, status)
select
  cls.id,
  date_trunc('day', now() + interval '7 day') + time '15:00',
  cls.zoom_link,
  'SCHEDULED'::session_status_enum
from cls
where not exists (
  select 1 from sessions where class_id = cls.id and date_trunc('day', date_time) = date_trunc('day', now() + interval '7 day')
);

---------------------------------------------
-- 4. Enrolments ----------------------------
---------------------------------------------
with cls as (
  select id from classes where name = 'Ekskul Design Sprint - Jumat'
),
coders as (
  select id, username from users where username in ('coder.farrel', 'coder.salma')
)
insert into enrollments (class_id, coder_id)
select cls.id, coders.id
from cls cross join coders
where not exists (
  select 1 from enrollments e where e.class_id = cls.id and e.coder_id = coders.id
);

---------------------------------------------
-- 5. Attendance for today ------------------
---------------------------------------------
with cls as (
  select id from classes where name = 'Ekskul Design Sprint - Jumat'
),
today_session as (
  select id, class_id from sessions
  where class_id in (select id from cls)
    and date_trunc('day', date_time) = date_trunc('day', now())
),
students as (
  select u.id as coder_id, u.full_name
  from users u
  where u.username in ('coder.farrel', 'coder.salma')
),
coach as (
  select id from users where username = 'coach.nadia'
)
insert into attendance (session_id, coder_id, status, reason, recorded_by)
select
  today_session.id,
  students.coder_id,
  (case students.full_name
    when 'Farrel Wijaya' then 'PRESENT'
    else 'ABSENT'
  end)::attendance_status_enum,
  case students.full_name
    when 'Farrel Wijaya' then null
    else 'Izin keperluan keluarga'
  end,
  coach.id
from today_session, students, coach
where not exists (
  select 1 from attendance a
  where a.session_id = today_session.id and a.coder_id = students.coder_id
);

---------------------------------------------
-- 6. Materials (general & supplemental) ----
---------------------------------------------
with cls as (
  select id from classes where name = 'Ekskul Design Sprint - Jumat'
),
coach as (
  select id from users where username = 'coach.nadia'
)
insert into materials (
  class_id,
  title,
  description,
  file_url,
  uploaded_by_user_id,
  uploaded_by_role,
  visible_from_session_id
)
select
  cls.id,
  'Design Sprint Brief',
  'Overview materi untuk sesi hari ini',
  'https://docs.google.com/design-sprint-brief.pdf',
  coach.id,
  'COACH',
  (select id from sessions where class_id = cls.id order by date_time asc limit 1)
from cls, coach
where not exists (
  select 1 from materials m
  where m.class_id = cls.id and m.title = 'Design Sprint Brief'
);

---------------------------------------------
-- 7. Make-up task & submission -------------
---------------------------------------------
with absentees as (
  select attendance.session_id, attendance.coder_id
  from attendance
  join sessions on sessions.id = attendance.session_id
  where sessions.date_time::date = current_date
    and attendance.status = 'ABSENT'
),
coach as (
  select id from users where username = 'coach.nadia'
)
insert into make_up_tasks (
  attendance_id,
  coder_id,
  session_id,
  class_lesson_id,
  due_date,
  status,
  instructions
)
select
  (select id from attendance where session_id = absentees.session_id and coder_id = absentees.coder_id),
  absentees.coder_id,
  absentees.session_id,
  null,
  now() + interval '5 day',
  'PENDING_UPLOAD'::make_up_status_enum,
  'Lengkapi prototipe low-fidelity dan unggah hasilnya.'
from absentees
where not exists (
  select 1 from make_up_tasks mt where mt.session_id = absentees.session_id and mt.coder_id = absentees.coder_id
);

-- Submit sample if task exists
with task as (
  select id, coder_id, session_id from make_up_tasks
  where status = 'PENDING_UPLOAD'
    and coder_id = (select id from users where username = 'coder.salma')
  limit 1
)
insert into submissions (
  makeup_id,
  session_id,
  coder_id,
  file_path,
  file_type,
  notes,
  reviewed_by,
  reviewed_at,
  verdict
)
select
  task.id,
  task.session_id,
  task.coder_id,
  'submissions/' || task.coder_id || '/design-sprint-low-fi.zip',
  'zip',
  'Prototipe low fidelity - versi 1',
  null,
  null,
  null
from task
where not exists (
  select 1 from submissions s where s.makeup_id = task.id
);

---------------------------------------------
-- 8. WhatsApp log sample -------------------
---------------------------------------------
insert into whatsapp_message_logs (category, payload, status)
values (
  'REMINDER'::whatsapp_category_enum,
  jsonb_build_object(
    'class_name', 'Ekskul Design Sprint - Jumat',
    'session_date', (now())::date,
    'template', 'SESSION_REMINDER'
  ),
  'QUEUED'::whatsapp_status_enum
);

commit;
