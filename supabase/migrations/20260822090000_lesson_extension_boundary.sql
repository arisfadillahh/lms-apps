begin;

-- Keep the already-applied extension schema and replace only the transaction
-- guard. The source session may be completed/attended; the first session of
-- the next lesson is the immutable boundary.
create or replace function public.extend_class_lesson(
  p_class_id uuid,
  p_source_session_id uuid,
  p_source_class_lesson_id uuid,
  p_extended_by uuid,
  p_extended_by_role text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class public.classes%rowtype;
  v_session public.sessions%rowtype;
  v_source public.class_lessons%rowtype;
  v_added public.class_lessons%rowtype;
  v_previous_parts integer;
  v_new_parts integer;
  v_new_order integer;
  v_next_order integer;
  v_base_title text;
  v_target_session_id uuid;
  v_target_session_at timestamptz;
  v_next_lesson_session_id uuid;
  v_next_lesson_session_at timestamptz;
  v_next_lesson_session_status text;
  v_next_lesson_has_attendance boolean := false;
  v_session_ids uuid[];
  v_lesson record;
  v_assignment_index integer := 2;
begin
  if p_extended_by_role not in ('COACH', 'ADMIN') then
    raise exception 'Role tidak diizinkan memperpanjang lesson.' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_reason, ''))) not between 10 and 500 then
    raise exception 'Alasan perpanjangan harus 10-500 karakter.' using errcode = '22023';
  end if;

  select * into v_class
  from public.classes
  where id = p_class_id
  for update;

  if not found or v_class.type <> 'WEEKLY' then
    raise exception 'Perpanjangan lesson hanya tersedia untuk kelas weekly.' using errcode = '22023';
  end if;

  select * into v_session
  from public.sessions
  where id = p_source_session_id
    and class_id = p_class_id
    and status <> 'CANCELLED'
  for update;

  if not found then
    raise exception 'Sesi sumber tidak ditemukan atau sudah dibatalkan.' using errcode = 'P0002';
  end if;

  select cl.* into v_source
  from public.class_lessons cl
  join public.class_blocks cb on cb.id = cl.class_block_id
  where cl.id = p_source_class_lesson_id
    and cb.class_id = p_class_id
  for update of cl;

  if not found or v_source.lesson_template_id is null then
    raise exception 'Lesson kelas sumber tidak ditemukan.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.lesson_extensions
    where source_class_lesson_id = p_source_class_lesson_id
  ) then
    raise exception 'Part lesson ini sudah pernah diperpanjang.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.class_lessons cl
    where cl.class_block_id = v_source.class_block_id
      and cl.lesson_template_id = v_source.lesson_template_id
      and (cl.order_index, cl.id) > (v_source.order_index, v_source.id)
  ) then
    raise exception 'Lesson hanya dapat diperpanjang dari part terakhir.' using errcode = '22023';
  end if;

  -- Find the first assigned session of the next lesson in this class. The
  -- source session itself is intentionally excluded, even when it is already
  -- completed or has attendance rows.
  select cl.session_id, next_session.date_time, next_session.status::text
    into v_next_lesson_session_id, v_next_lesson_session_at, v_next_lesson_session_status
  from public.class_lessons cl
  join public.class_blocks cb on cb.id = cl.class_block_id
  join public.sessions next_session on next_session.id = cl.session_id
  where cb.class_id = p_class_id
    and next_session.status <> 'CANCELLED'
    and (
      cb.start_date > (select start_date from public.class_blocks where id = v_source.class_block_id)
      or (
        cb.start_date = (select start_date from public.class_blocks where id = v_source.class_block_id)
        and (cl.order_index, cl.id) > (v_source.order_index, v_source.id)
      )
    )
  order by cb.start_date, cl.order_index, cl.id
  limit 1;

  if v_next_lesson_session_id is not null then
    select exists (
      select 1
      from public.attendance
      where session_id = v_next_lesson_session_id
    ) into v_next_lesson_has_attendance;

    if v_next_lesson_has_attendance
      or v_next_lesson_session_status = 'COMPLETED'
      or v_next_lesson_session_at <= now() then
      raise exception 'Lesson tidak dapat diperpanjang karena pertemuan pertama lesson berikutnya sudah dimulai atau sudah diabsen.' using errcode = '22023';
    end if;
  end if;

  select count(*) into v_previous_parts
  from public.class_lessons cl
  where cl.class_block_id = v_source.class_block_id
    and cl.lesson_template_id = v_source.lesson_template_id;

  v_new_parts := v_previous_parts + 1;
  v_new_order := v_source.order_index + 1;

  select min(order_index) into v_next_order
  from public.class_lessons
  where class_block_id = v_source.class_block_id
    and order_index > v_source.order_index;

  if v_next_order is not null and v_new_order >= v_next_order then
    raise exception 'Urutan lesson kelas tidak memiliki ruang untuk part tambahan.' using errcode = '23505';
  end if;

  select array_agg(id order by date_time, id)
    into v_session_ids
  from public.sessions
  where class_id = p_class_id
    and status <> 'CANCELLED'
    and date_time > v_session.date_time;

  if coalesce(array_length(v_session_ids, 1), 0) = 0 then
    raise exception 'Belum ada pertemuan aktif berikutnya untuk kelas ini.' using errcode = 'P0002';
  end if;

  v_target_session_id := v_session_ids[1];
  select date_time into v_target_session_at from public.sessions where id = v_target_session_id;

  -- Release every assignment after the source first, avoiding the unique
  -- session constraint while preserving history up to and including source.
  update public.class_lessons cl
  set session_id = null, unlock_at = null
  from public.class_blocks cb, public.sessions assigned_session
  where cb.id = cl.class_block_id
    and cb.class_id = p_class_id
    and assigned_session.id = cl.session_id
    and assigned_session.status <> 'CANCELLED'
    and assigned_session.date_time > v_session.date_time;

  update public.class_lessons cl
  set session_id = null, unlock_at = null
  from public.class_blocks cb
  where cb.id = cl.class_block_id
    and cb.class_id = p_class_id
    and cl.id <> p_source_class_lesson_id
    and cl.session_id = p_source_session_id;

  update public.class_lessons
  set session_id = p_source_session_id,
      unlock_at = v_session.date_time
  where id = p_source_class_lesson_id;

  v_base_title := trim(regexp_replace(v_source.title, '\\s*\\(Part\\s+[0-9]+\\)\\s*$', '', 'i'));

  insert into public.class_lessons (
    class_block_id,
    lesson_template_id,
    title,
    summary,
    order_index,
    session_id,
    unlock_at,
    make_up_instructions,
    slide_url,
    coach_example_url,
    coach_example_storage_path,
    is_extended
  ) values (
    v_source.class_block_id,
    v_source.lesson_template_id,
    v_base_title || ' (Part ' || v_new_parts || ')',
    v_source.summary,
    v_new_order,
    v_target_session_id,
    v_target_session_at,
    v_source.make_up_instructions,
    v_source.slide_url,
    v_source.coach_example_url,
    v_source.coach_example_storage_path,
    true
  ) returning * into v_added;

  for v_lesson in
    select cl.id
    from public.class_lessons cl
    join public.class_blocks cb on cb.id = cl.class_block_id
    where cb.class_id = p_class_id
      and cl.id <> v_added.id
      and (
        cb.start_date > (select start_date from public.class_blocks where id = v_source.class_block_id)
        or (
          cb.start_date = (select start_date from public.class_blocks where id = v_source.class_block_id)
          and cl.order_index > v_source.order_index
        )
      )
    order by cb.start_date, cl.order_index, cl.id
  loop
    update public.class_lessons
    set session_id = case
          when v_assignment_index <= coalesce(array_length(v_session_ids, 1), 0)
            then v_session_ids[v_assignment_index]
          else null
        end,
        unlock_at = case
          when v_assignment_index <= coalesce(array_length(v_session_ids, 1), 0)
            then (select date_time from public.sessions where id = v_session_ids[v_assignment_index])
          else null
        end
    where id = v_lesson.id;

    v_assignment_index := v_assignment_index + 1;
  end loop;

  insert into public.lesson_extensions (
    class_id,
    class_block_id,
    lesson_template_id,
    source_class_lesson_id,
    added_class_lesson_id,
    source_session_id,
    target_session_id,
    extended_by,
    extended_by_role,
    reason,
    previous_parts,
    new_parts
  ) values (
    p_class_id,
    v_source.class_block_id,
    v_source.lesson_template_id,
    p_source_class_lesson_id,
    v_added.id,
    p_source_session_id,
    v_target_session_id,
    p_extended_by,
    p_extended_by_role,
    trim(p_reason),
    v_previous_parts,
    v_new_parts
  );

  return jsonb_build_object(
    'addedClassLessonId', v_added.id,
    'newPartNumber', v_new_parts,
    'targetSessionId', v_target_session_id,
    'targetSessionAt', v_target_session_at
  );
end;
$$;

revoke all on function public.extend_class_lesson(uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.extend_class_lesson(uuid, uuid, uuid, uuid, text, text)
  to service_role;

commit;
