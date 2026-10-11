-- Recommendations are computed from live CURRENT class blocks, not a cached class ID.
-- This migration follows 20261011120000 and is not executed by this change.
CREATE VIEW public.block_placement_candidates AS
SELECT placement.id AS placement_id,
       klass.id AS class_id,
       klass.name AS class_name,
       (SELECT count(DISTINCT lesson.id) + 1
        FROM public.class_lessons lesson
        JOIN public.sessions session ON session.id = lesson.session_id
        WHERE lesson.class_block_id = current_block.id
          AND session.status = 'COMPLETED')::integer AS class_position,
       (SELECT count(*) FROM public.enrollments enrollment
        WHERE enrollment.class_id = klass.id AND enrollment.status = 'ACTIVE')::integer
         AS active_coder_count,
       klass.schedule_day,
       klass.schedule_time::text AS schedule_time
FROM public.coder_block_placements placement
JOIN public.classes klass ON klass.level_id = placement.level_id
  AND klass.id <> placement.source_class_id
  AND klass.type = 'WEEKLY' AND klass.lifecycle_status = 'ACTIVE'
  AND klass.archived_at IS NULL AND klass.end_date >= current_date
JOIN LATERAL (
  SELECT block.id FROM public.class_blocks block
  WHERE block.class_id = klass.id AND block.block_id = placement.block_id
    AND block.status = 'CURRENT'
  ORDER BY block.start_date DESC, block.id DESC LIMIT 1
) current_block ON true
WHERE placement.status = 'NEEDS_BLOCK_PLACEMENT';
REVOKE ALL ON public.block_placement_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.block_placement_candidates TO service_role;

CREATE OR REPLACE FUNCTION public.block_placement_recommendation_text(p_placement_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN candidate.class_id IS NULL
    THEN 'Buka kelas baru untuk blok ' || block.name
    ELSE 'Pindahkan ke kelas ' || candidate.class_name END
  FROM public.coder_block_placements placement
  JOIN public.blocks block ON block.id = placement.block_id
  LEFT JOIN LATERAL (
    SELECT class_id, class_name FROM public.block_placement_candidates candidate
    WHERE candidate.placement_id = placement.id
    -- Same priority as blockPlacementRecommendation.ts: nearest, not behind,
    -- lower occupancy, then deterministic schedule and immutable ID.
    ORDER BY abs(candidate.class_position - placement.entry_lesson_position),
      CASE WHEN candidate.class_position < placement.entry_lesson_position THEN 1 ELSE 0 END,
      candidate.active_coder_count, candidate.schedule_day, candidate.schedule_time,
      candidate.class_id
    LIMIT 1
  ) candidate ON true
  WHERE placement.id = p_placement_id;
$$;
REVOKE ALL ON FUNCTION public.block_placement_recommendation_text(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_placement_recommendation_text(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_deferred_block_placement(
  p_coder_id uuid, p_level_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_needed public.coder_block_progress%ROWTYPE;
  v_enrollment public.enrollments%ROWTYPE;
  v_placement_id uuid;
  v_coder_name text;
  v_block_name text;
BEGIN
  SELECT * INTO v_needed FROM public.coder_block_progress
  WHERE coder_id = p_coder_id AND level_id = p_level_id
    AND deferred_after_class = true AND status <> 'COMPLETED'
  ORDER BY journey_order LIMIT 1;
  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.coder_block_progress p
    WHERE p.coder_id = p_coder_id AND p.level_id = p_level_id
      AND p.deferred_after_class = false AND p.status <> 'COMPLETED'
  ) THEN RETURN NULL; END IF;

  SELECT e.* INTO v_enrollment FROM public.enrollments e
  JOIN public.classes c ON c.id = e.class_id
  WHERE e.coder_id = p_coder_id AND e.status = 'ACTIVE'
    AND c.level_id = p_level_id AND c.type = 'WEEKLY'
  ORDER BY e.enrolled_at DESC LIMIT 1 FOR UPDATE OF e;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO public.coder_block_placements
    (coder_id, level_id, block_id, source_class_id, source_enrollment_id, entry_lesson_position)
  VALUES (p_coder_id, p_level_id, v_needed.block_id, v_enrollment.class_id,
          v_enrollment.id, greatest(coalesce(v_needed.entry_lesson_position, 1), 1))
  ON CONFLICT (coder_id, level_id) WHERE status = 'NEEDS_BLOCK_PLACEMENT'
  DO NOTHING RETURNING id INTO v_placement_id;
  IF v_placement_id IS NOT NULL THEN
    SELECT full_name INTO v_coder_name FROM public.users WHERE id = p_coder_id;
    SELECT name INTO v_block_name FROM public.blocks WHERE id = v_needed.block_id;
    INSERT INTO public.notifications(user_id, title, message, type, is_read, reference_key)
    SELECT id, 'Coder perlu penempatan blok',
      coalesce(v_coder_name, 'Coder') || ' perlu kelas aktif untuk blok ' || coalesce(v_block_name, v_needed.block_id::text) ||
      ' (lanjut dari pertemuan ' || greatest(coalesce(v_needed.entry_lesson_position, 1), 1)::text || '). ' ||
      'Rekomendasi saat dibuat: ' || public.block_placement_recommendation_text(v_placement_id) ||
      '. Periksa halaman Penempatan Blok untuk saran terbaru.',
      'BLOCK_PLACEMENT', false, 'block-placement:' || v_placement_id::text
    FROM public.users WHERE role = 'ADMIN' AND is_active = true
    ON CONFLICT (user_id, reference_key) WHERE reference_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN coalesce(v_placement_id, (SELECT id FROM public.coder_block_placements
    WHERE coder_id = p_coder_id AND level_id = p_level_id
      AND status = 'NEEDS_BLOCK_PLACEMENT'));
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_deferred_block_placement(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_deferred_block_placement(uuid, uuid) TO service_role;

-- Existing open notifications from the preceding migration gain the action once.
UPDATE public.notifications notification
SET message = notification.message || ' Rekomendasi saat dibuat: ' ||
  public.block_placement_recommendation_text(placement.id) ||
  '. Periksa halaman Penempatan Blok untuk saran terbaru.'
FROM public.coder_block_placements placement
WHERE notification.reference_key = 'block-placement:' || placement.id::text
  AND placement.status = 'NEEDS_BLOCK_PLACEMENT'
  AND notification.message NOT LIKE '% Rekomendasi saat dibuat:%';
