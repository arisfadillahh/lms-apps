-- Aris: after every transfer, lesson position follows the destination class.
-- This supersedes the max(personal, destination) rule from 20261011120000.
CREATE OR REPLACE FUNCTION public.align_transferred_coder_journey(
  p_coder_id uuid, p_level_id uuid, p_source_class_id uuid,
  p_target_class_id uuid, p_effective_at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_target_block_id uuid;
  v_target_class_block_id uuid;
  v_target_order integer;
  v_entry_lesson_position integer;
  v_source_block_id uuid;
  v_source_class_block_id uuid;
  v_source_resume_position integer;
  v_next_order integer;
  v_new_order integer := 0;
  v_first_pending boolean := true;
  v_row record;
BEGIN
  SELECT cb.block_id, cb.id INTO v_target_block_id, v_target_class_block_id
  FROM public.class_blocks cb
  WHERE cb.class_id = p_target_class_id AND cb.status IN ('CURRENT', 'UPCOMING')
  ORDER BY CASE WHEN cb.status = 'CURRENT' THEN 0 ELSE 1 END,
    CASE WHEN cb.status = 'CURRENT' THEN cb.start_date END DESC,
    CASE WHEN cb.status = 'UPCOMING' THEN cb.start_date END ASC, cb.id
  LIMIT 1;
  IF v_target_block_id IS NULL THEN
    RAISE EXCEPTION 'Kelas tujuan belum memiliki blok aktif/berikutnya.';
  END IF;
  SELECT order_index INTO v_target_order FROM public.blocks
  WHERE id = v_target_block_id AND level_id = p_level_id;
  IF v_target_order IS NULL THEN
    RAISE EXCEPTION 'Blok kelas tujuan bukan bagian dari level coder.';
  END IF;
  -- ASUMSI 1/2: posisi lanjut selalu mengikuti kelas tujuan, termasuk kelas yang lebih tertinggal; sesi terlewat hanya catch-up.
  SELECT count(DISTINCT cl.id) + 1 INTO v_entry_lesson_position
  FROM public.class_lessons cl
  JOIN public.sessions s ON s.id = cl.session_id
  WHERE cl.class_block_id = v_target_class_block_id AND s.status = 'COMPLETED';

  SELECT block_id INTO v_source_block_id FROM public.coder_block_progress
  WHERE coder_id = p_coder_id AND level_id = p_level_id AND status = 'IN_PROGRESS'
  ORDER BY journey_order LIMIT 1;
  SELECT id INTO v_source_class_block_id FROM public.class_blocks
  WHERE class_id = p_source_class_id AND block_id = v_source_block_id
  ORDER BY CASE WHEN status = 'CURRENT' THEN 0 ELSE 1 END, start_date DESC LIMIT 1;
  -- ASUMSI 5: posisi asal dihitung dari jumlah pelajaran dengan attendance PRESENT.
  SELECT count(DISTINCT cl.id) + 1 INTO v_source_resume_position
  FROM public.class_lessons cl
  JOIN public.sessions s ON s.id = cl.session_id
  JOIN public.attendance a ON a.session_id = s.id
    AND a.coder_id = p_coder_id AND a.status = 'PRESENT'
  WHERE cl.class_block_id = v_source_class_block_id
    AND s.status = 'COMPLETED' AND s.date_time <= p_effective_at;

  PERFORM 1 FROM public.coder_block_progress
  WHERE coder_id = p_coder_id AND level_id = p_level_id FOR UPDATE;
  SELECT coalesce(max(journey_order), -1) + 1 INTO v_next_order
  FROM public.coder_block_progress WHERE coder_id = p_coder_id AND level_id = p_level_id;
  IF v_next_order >= 1000000 THEN RAISE EXCEPTION 'Journey order is outside supported range'; END IF;

  FOR v_row IN SELECT id FROM public.blocks WHERE level_id = p_level_id ORDER BY order_index, id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE coder_id = p_coder_id AND block_id = v_row.id) THEN
      INSERT INTO public.coder_block_progress
        (coder_id, level_id, block_id, journey_order, status)
      VALUES (p_coder_id, p_level_id, v_row.id, v_next_order, 'PENDING');
      v_next_order := v_next_order + 1;
    END IF;
  END LOOP;
  IF v_next_order >= 1000000 THEN RAISE EXCEPTION 'Journey order is outside supported range'; END IF;

  -- Move all rows out of the unique journey_order range before reordering.
  UPDATE public.coder_block_progress SET journey_order = journey_order + 1000000
  WHERE coder_id = p_coder_id AND level_id = p_level_id;

  FOR v_row IN
    SELECT p.id, p.block_id, p.status, b.order_index
    FROM public.coder_block_progress p JOIN public.blocks b ON b.id = p.block_id
    WHERE p.coder_id = p_coder_id AND p.level_id = p_level_id
    ORDER BY CASE WHEN p.status = 'COMPLETED' THEN 0 ELSE 1 END,
      CASE WHEN p.status = 'COMPLETED' THEN p.journey_order END,
      CASE WHEN p.status = 'COMPLETED' THEN 0
           WHEN p.block_id = v_source_block_id AND p.block_id <> v_target_block_id THEN 2
           WHEN b.order_index >= v_target_order THEN 0 ELSE 1 END,
      b.order_index, p.id
  LOOP
    UPDATE public.coder_block_progress SET
      journey_order = v_new_order,
      status = (CASE WHEN v_row.status = 'COMPLETED' THEN 'COMPLETED'
                    WHEN v_first_pending THEN 'IN_PROGRESS' ELSE 'PENDING' END)::public.coder_block_status_enum,
      completed_at = CASE WHEN v_row.status = 'COMPLETED' THEN completed_at ELSE NULL END,
      completion_source = CASE WHEN v_row.status = 'COMPLETED' THEN completion_source ELSE NULL END,
      deferred_after_class = v_row.status <> 'COMPLETED' AND
        (v_row.order_index < v_target_order OR
         (v_row.block_id = v_source_block_id AND v_row.block_id <> v_target_block_id)),
      entry_lesson_position = CASE WHEN v_row.block_id = v_target_block_id
        THEN v_entry_lesson_position
        WHEN v_row.block_id = v_source_block_id AND v_row.status <> 'COMPLETED'
        THEN greatest(coalesce(entry_lesson_position, 1), v_source_resume_position)
        ELSE entry_lesson_position END
    WHERE id = v_row.id;
    IF v_row.status <> 'COMPLETED' THEN v_first_pending := false; END IF;
    v_new_order := v_new_order + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.align_transferred_coder_journey(uuid, uuid, uuid, uuid, timestamptz) FROM PUBLIC;
