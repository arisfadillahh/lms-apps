-- REVIEW ONLY. Execute manually with a privileged SQL client AFTER migrations
-- 20260910090000, 20260912150000, 20261011090000 are applied and Aris
-- confirms the earlier Game Development block really was completed.
-- Atomic, guarded, idempotent. Never run as part of an application request.
BEGIN;
DO $repair$
DECLARE
  v_coder uuid := 'afe24d5c-509d-43c1-951e-0a3f7d80ac39';
  v_class uuid := 'f300247f-4a3d-4bde-8d13-57251b99f2ea';
  v_enrollment uuid := 'aa15cd14-e9d3-4ec9-9b93-5af2be1bad32';
  v_progression uuid := '6b1bbcca-1d20-46f5-86d4-5834da4f71c0';
  v_status text;
  v_reason text;
  v_count integer;
BEGIN
  SELECT status, exit_reason INTO v_status, v_reason
  FROM public.enrollments WHERE id = v_enrollment AND coder_id = v_coder AND class_id = v_class FOR UPDATE;
  IF NOT FOUND OR NOT ((v_status = 'ACTIVE' AND v_reason IS NULL)
    OR (v_status = 'INACTIVE' AND v_reason = 'COMPLETED')) THEN
    RAISE EXCEPTION 'Enrollment no longer matches the reviewed snapshot';
  END IF;
  PERFORM 1 FROM public.coder_level_progressions
    WHERE id = v_progression FOR UPDATE;
  PERFORM 1 FROM public.coder_block_progress
    WHERE coder_id = v_coder FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = v_class
      AND lifecycle_status = 'ACTIVE' AND end_date > current_date) OR
     NOT EXISTS (SELECT 1 FROM public.class_blocks WHERE class_id = v_class
      AND id = '4bd91139-7b13-46ff-a768-b0c73e7d4f36' AND status = 'CURRENT') THEN
    RAISE EXCEPTION 'Class cycle changed; review again';
  END IF;
  SELECT count(*) INTO v_count FROM public.coder_block_progress
  WHERE coder_id = v_coder AND level_id = '1b7176fc-7da3-49f5-9899-af54ab466434';
  IF v_count <> 5 THEN RAISE EXCEPTION 'Unexpected progress row count'; END IF;

  -- A second run is a no-op. Never rewrite a later legitimate achievement.
  IF NOT EXISTS (SELECT 1 FROM public.coder_level_progressions WHERE id = v_progression)
     AND EXISTS (SELECT 1 FROM public.coder_block_progress
       WHERE id = 'e3b4b11b-1293-432b-a562-9e78ae820921' AND status = 'IN_PROGRESS')
     AND NOT EXISTS (SELECT 1 FROM public.coder_block_progress
       WHERE coder_id = v_coder AND journey_order > 1 AND status <> 'PENDING') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.coder_level_progressions
    WHERE id = v_progression AND coder_id = v_coder AND source_enrollment_id = v_enrollment
      AND status = 'WAITING_PLACEMENT' AND target_class_id IS NULL AND target_enrollment_id IS NULL) THEN
    RAISE EXCEPTION 'Progression changed; review again';
  END IF;
  SELECT count(*) INTO v_count FROM public.coder_block_progress
  WHERE coder_id = v_coder AND status = 'COMPLETED';
  IF v_count <> 5 THEN RAISE EXCEPTION 'Progress changed; review again'; END IF;

  -- The first block was before the current Interactive block. Preserve its
  -- historical status but do not mark it individually verified.
  UPDATE public.coder_block_progress SET completion_source = NULL
    WHERE id = '2bf3a002-fbcf-4b8d-9ff1-b4fb18c18623';
  UPDATE public.coder_block_progress
    SET status = CASE WHEN id = 'e3b4b11b-1293-432b-a562-9e78ae820921' THEN 'IN_PROGRESS' ELSE 'PENDING' END,
        completed_at = NULL, completion_source = NULL
    WHERE id IN ('e3b4b11b-1293-432b-a562-9e78ae820921',
      '3125fdec-94dc-47de-a90d-72cd6f03a741',
      '10975c71-b298-467f-b4df-f1bc854ab9e2',
      '063572c9-88e1-4b00-b1a9-c66c025734c9');
  DELETE FROM public.coder_level_progressions WHERE id = v_progression;
  IF v_status = 'INACTIVE' THEN
    UPDATE public.enrollments SET status = 'ACTIVE', exit_reason = NULL, ended_at = NULL
    WHERE id = v_enrollment;
  END IF;
END;
$repair$;
COMMIT;
