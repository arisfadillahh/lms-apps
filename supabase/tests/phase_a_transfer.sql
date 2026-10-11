-- Run only against disposable lms_test after all versioned migrations.
BEGIN;
DO $test$
DECLARE
  v_admin uuid := gen_random_uuid();
  v_coach uuid := gen_random_uuid();
  v_coder uuid := gen_random_uuid();
  v_second uuid := gen_random_uuid();
  v_third uuid := gen_random_uuid();
  v_level uuid := gen_random_uuid();
  v_blocks uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_source uuid := gen_random_uuid();
  v_same uuid := gen_random_uuid();
  v_destination uuid := gen_random_uuid();
  v_behind uuid := gen_random_uuid();
  v_ahead uuid := gen_random_uuid();
  v_other_source uuid := gen_random_uuid();
  v_cb uuid;
  v_session uuid;
  v_placement uuid;
  v_position integer;
  v_status text;
  v_count integer;
  v_i integer;
BEGIN
  INSERT INTO public.users(id, username, password_hash, full_name, role)
  VALUES (v_admin, 'phase-a-admin', 'local-only', 'Local Admin', 'ADMIN'),
    (v_coach, 'phase-a-coach', 'local-only', 'Local Coach', 'COACH'),
    (v_coder, 'phase-a-coder', 'local-only', 'Local Coder', 'CODER'),
    (v_second, 'phase-a-second', 'local-only', 'Local Second', 'CODER'),
    (v_third, 'phase-a-third', 'local-only', 'Local Third', 'CODER');
  INSERT INTO public.levels(id, name, order_index) VALUES (v_level, 'Local Level', 80);
  FOR v_i IN 1..5 LOOP
    INSERT INTO public.blocks(id, level_id, name, order_index)
    VALUES (v_blocks[v_i], v_level, 'Local Block ' || v_i, v_i);
  END LOOP;
  INSERT INTO public.classes(id, name, type, level_id, coach_id, schedule_day, schedule_time,
    zoom_link, start_date, end_date)
  VALUES
    (v_source, 'Local Source A', 'WEEKLY', v_level, v_coach, 'SATURDAY', '09:00', 'local', current_date-10, current_date+365),
    (v_same, 'Local Same A', 'WEEKLY', v_level, v_coach, 'SATURDAY', '10:00', 'local', current_date-10, current_date+365),
    (v_destination, 'Local Destination D', 'WEEKLY', v_level, v_coach, 'SATURDAY', '11:00', 'local', current_date-10, current_date+365),
    (v_behind, 'Local C Behind', 'WEEKLY', v_level, v_coach, 'SATURDAY', '12:00', 'local', current_date-10, current_date+365),
    (v_ahead, 'Local C Ahead', 'WEEKLY', v_level, v_coach, 'SATURDAY', '13:00', 'local', current_date-10, current_date+365),
    (v_other_source, 'Local Other Source', 'WEEKLY', v_level, v_coach, 'SUNDAY', '09:00', 'local', current_date-10, current_date+365);
  INSERT INTO public.class_blocks(class_id, block_id, status, start_date, end_date)
  VALUES (v_source, v_blocks[1], 'CURRENT', current_date-10, current_date+30),
    (v_same, v_blocks[1], 'CURRENT', current_date-10, current_date+30),
    (v_destination, v_blocks[4], 'CURRENT', current_date-10, current_date+30),
    (v_destination, v_blocks[5], 'UPCOMING', current_date+31, current_date+60),
    (v_behind, v_blocks[3], 'CURRENT', current_date-10, current_date+30),
    (v_ahead, v_blocks[3], 'CURRENT', current_date-10, current_date+30),
    (v_other_source, v_blocks[5], 'CURRENT', current_date-10, current_date+30);
  -- The same-block class has nine finished meetings: entry position 10.
  SELECT id INTO v_cb FROM public.class_blocks WHERE class_id = v_same AND block_id = v_blocks[1];
  FOR v_i IN 1..9 LOOP
    INSERT INTO public.sessions(class_id, date_time, zoom_link_snapshot, status)
    VALUES (v_same, now()-interval '1 day' * (10-v_i), 'local', 'COMPLETED') RETURNING id INTO v_session;
    INSERT INTO public.class_lessons(class_block_id, title, order_index, session_id)
    VALUES (v_cb, 'Same lesson ' || v_i, v_i, v_session);
  END LOOP;
  INSERT INTO public.enrollments(class_id, coder_id, enrolled_at) VALUES (v_source, v_coder, now()-interval '2 days');
  FOR v_i IN 1..5 LOOP
    INSERT INTO public.coder_block_progress(coder_id, level_id, block_id, journey_order, status)
    VALUES (v_coder, v_level, v_blocks[v_i], v_i-1, CASE WHEN v_i=1 THEN 'IN_PROGRESS' ELSE 'PENDING' END::public.coder_block_status_enum);
  END LOOP;
  PERFORM public.transfer_coder_enrollment(v_coder, v_source, v_same, now(), 'same block test', v_admin);
  SELECT entry_lesson_position INTO v_position FROM public.coder_block_progress
    WHERE coder_id=v_coder AND block_id=v_blocks[1];
  IF v_position <> 10 THEN RAISE EXCEPTION 'same-block position expected 10, got %', v_position; END IF;
  RAISE NOTICE 'PASS same block: destination position %', v_position;

  -- ASUMSI 2: a coder can also enter a class that is behind the source.
  INSERT INTO public.enrollments(class_id,coder_id,enrolled_at)
    VALUES(v_same,v_third,now()-interval '2 days');
  FOR v_i IN 1..5 LOOP
    INSERT INTO public.coder_block_progress(coder_id,level_id,block_id,journey_order,status)
      VALUES(v_third,v_level,v_blocks[v_i],v_i-1,
        CASE WHEN v_i=1 THEN 'IN_PROGRESS' ELSE 'PENDING' END::public.coder_block_status_enum);
  END LOOP;
  PERFORM public.transfer_coder_enrollment(v_third,v_same,v_source,now(),'same block behind',v_admin);
  SELECT entry_lesson_position INTO v_position FROM public.coder_block_progress
    WHERE coder_id=v_third AND block_id=v_blocks[1];
  IF v_position<>1 THEN RAISE EXCEPTION 'behind destination should reset entry to 1, got %',v_position; END IF;
  RAISE NOTICE 'PASS same block behind: destination position %',v_position;

  -- Prepare C unfinished at four personally attended lessons, then transfer to D.
  UPDATE public.coder_block_progress SET status='COMPLETED', completion_source='MANUAL', completed_at=now()
    WHERE coder_id=v_coder AND block_id IN (v_blocks[1], v_blocks[2]);
  UPDATE public.coder_block_progress SET status='IN_PROGRESS'
    WHERE coder_id=v_coder AND block_id=v_blocks[3];
  UPDATE public.class_blocks SET status='COMPLETED' WHERE class_id=v_same AND block_id=v_blocks[1];
  INSERT INTO public.class_blocks(class_id, block_id, status, start_date, end_date)
    VALUES(v_same, v_blocks[3], 'CURRENT', current_date-10, current_date+30) RETURNING id INTO v_cb;
  FOR v_i IN 1..4 LOOP
    INSERT INTO public.sessions(class_id, date_time, zoom_link_snapshot, status)
    VALUES (v_same, now()-interval '1 day' * (5-v_i), 'local', 'COMPLETED') RETURNING id INTO v_session;
    INSERT INTO public.class_lessons(class_block_id, title, order_index, session_id)
    VALUES(v_cb, 'C lesson ' || v_i, v_i, v_session);
    INSERT INTO public.attendance(session_id, coder_id, status, recorded_by)
    VALUES(v_session, v_coder, 'PRESENT', v_coach);
  END LOOP;
  PERFORM public.transfer_coder_enrollment(v_coder, v_same, v_destination, now(), 'different block test', v_admin);
  SELECT entry_lesson_position, status INTO v_position, v_status FROM public.coder_block_progress
    WHERE coder_id=v_coder AND block_id=v_blocks[3];
  IF v_position<>5 OR v_status<>'PENDING' THEN
    RAISE EXCEPTION 'C must be pending at position 5; got % %',v_status,v_position;
  END IF;
  RAISE NOTICE 'PASS different block: C pending, resume position %', v_position;
  -- The former C class has ended, leaving the two C candidates for ranking.
  UPDATE public.classes SET lifecycle_status='ENDED' WHERE id=v_same;

  -- Candidate C classes at positions 4 and 6. Position 6 wins equal distance.
  FOR v_i IN 1..5 LOOP
    SELECT id INTO v_cb FROM public.class_blocks WHERE class_id=v_ahead AND block_id=v_blocks[3];
    INSERT INTO public.sessions(class_id, date_time, zoom_link_snapshot, status)
      VALUES(v_ahead, now()-interval '1 day' * (6-v_i), 'local', 'COMPLETED') RETURNING id INTO v_session;
    INSERT INTO public.class_lessons(class_block_id, title, order_index, session_id)
      VALUES(v_cb, 'Ahead C '||v_i, v_i, v_session);
    IF v_i <= 3 THEN
      SELECT id INTO v_cb FROM public.class_blocks WHERE class_id=v_behind AND block_id=v_blocks[3];
      INSERT INTO public.sessions(class_id, date_time, zoom_link_snapshot, status)
        VALUES(v_behind, now()-interval '1 day' * (4-v_i), 'local', 'COMPLETED') RETURNING id INTO v_session;
      INSERT INTO public.class_lessons(class_block_id, title, order_index, session_id)
        VALUES(v_cb, 'Behind C '||v_i, v_i, v_session);
    END IF;
  END LOOP;
  UPDATE public.coder_block_progress SET status='COMPLETED', completion_source='MANUAL', completed_at=now()
    WHERE coder_id=v_coder AND block_id IN (v_blocks[4], v_blocks[5]);
  SELECT id INTO v_placement FROM public.coder_block_placements
    WHERE coder_id=v_coder AND status='NEEDS_BLOCK_PLACEMENT';
  IF v_placement IS NULL THEN RAISE EXCEPTION 'missing deferred placement'; END IF;
  IF (SELECT count(*) FROM public.coder_block_placements WHERE coder_id=v_coder AND status='NEEDS_BLOCK_PLACEMENT')<>1
    OR (SELECT count(*) FROM public.notifications WHERE reference_key='block-placement:'||v_placement::text)<>1 THEN
    RAISE EXCEPTION 'placement or notification was duplicated/missing';
  END IF;
  IF public.block_placement_recommendation_text(v_placement)<>'Pindahkan ke kelas Local C Ahead' THEN
    RAISE EXCEPTION 'wrong recommendation: %',public.block_placement_recommendation_text(v_placement);
  END IF;
  PERFORM public.ensure_deferred_block_placement(v_coder,v_level);
  IF (SELECT count(*) FROM public.notifications WHERE reference_key='block-placement:'||v_placement::text)<>1 THEN
    RAISE EXCEPTION 'duplicate notification after retry'; END IF;
  RAISE NOTICE 'PASS placement/recommendation/idempotency: one queue, one notification, ahead class wins';

  PERFORM public.set_class_lifecycle_status(v_destination,'ENDED',v_admin);
  IF (SELECT status FROM public.enrollments WHERE class_id=v_destination AND coder_id=v_coder)<>'ACTIVE' THEN
    RAISE EXCEPTION 'ENDED class deactivated waiting coder'; END IF;
  IF EXISTS (SELECT 1 FROM public.finalize_coder_level(v_coder,v_level,v_destination)) THEN
    RAISE EXCEPTION 'waiting coder was finalized'; END IF;
  RAISE NOTICE 'PASS ENDED: enrollment ACTIVE and no finalization';
  PERFORM public.transfer_coder_enrollment(v_coder,v_destination,v_ahead,now(),'place C in current block',v_admin);
  SELECT entry_lesson_position, status INTO v_position,v_status FROM public.coder_block_progress
    WHERE coder_id=v_coder AND block_id=v_blocks[3];
  IF v_position<>6 OR v_status<>'IN_PROGRESS' OR
    (SELECT status FROM public.coder_block_placements WHERE id=v_placement)<>'PLACED' THEN
    RAISE EXCEPTION 'placement transfer failed: C % at %, queue %',v_status,v_position,
      (SELECT status FROM public.coder_block_placements WHERE id=v_placement);
  END IF;
  RAISE NOTICE 'PASS official placement transfer: C IN_PROGRESS at destination position %',v_position;

  INSERT INTO public.enrollments(class_id,coder_id,enrolled_at)
    VALUES(v_other_source,v_second,now()-interval '1 day');
  FOR v_i IN 1..5 LOOP
    INSERT INTO public.coder_block_progress(coder_id,level_id,block_id,journey_order,status,deferred_after_class)
      VALUES(v_second,v_level,v_blocks[v_i],v_i-1,
        CASE WHEN v_i=2 THEN 'PENDING' ELSE 'COMPLETED' END::public.coder_block_status_enum,
        v_i=2);
  END LOOP;
  v_placement:=public.ensure_deferred_block_placement(v_second,v_level);
  IF public.block_placement_recommendation_text(v_placement)<>'Buka kelas baru untuk blok Local Block 2' THEN
    RAISE EXCEPTION 'missing new-class recommendation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE reference_key='block-placement:'||v_placement::text
    AND message LIKE '%Buka kelas baru untuk blok Local Block 2%') THEN
    RAISE EXCEPTION 'new-class action missing from admin notification'; END IF;
  RAISE NOTICE 'PASS no candidate: open new class recommendation and notification';
END;
$test$;
ROLLBACK;
