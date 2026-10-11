-- OPTIONAL DATA PROPOSAL. Never run automatically. Aris confirmed Game
-- Development was studied, Interactive is in progress, and level is unfinished.
-- Enrollment is already ACTIVE and is never changed here. Progression
-- cancellation is optional and requires Aris's separate decision.
-- Requires migrations 20261011090000 and 20261011100000.
BEGIN;
DO $repair$
DECLARE
  v_coder uuid := 'afe24d5c-509d-43c1-951e-0a3f7d80ac39';
  v_class uuid := 'f300247f-4a3d-4bde-8d13-57251b99f2ea';
  v_enrollment uuid := 'aa15cd14-e9d3-4ec9-9b93-5af2be1bad32';
  v_progression uuid := '6b1bbcca-1d20-46f5-86d4-5834da4f71c0';
  v_cancel_stale_progression boolean := false; -- Set true only after Aris approves cancellation.
  v_count integer;
BEGIN
  PERFORM 1 FROM public.enrollments
    WHERE id = v_enrollment AND coder_id = v_coder AND class_id = v_class
      AND status = 'ACTIVE' AND exit_reason IS NULL AND ended_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active enrollment changed; review again'; END IF;
  PERFORM 1 FROM public.coder_level_progressions
    WHERE id = v_progression AND coder_id = v_coder
      AND source_enrollment_id = v_enrollment AND status IN ('WAITING_PLACEMENT', 'CANCELLED')
      AND target_class_id IS NULL AND target_enrollment_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Progression changed; review again'; END IF;
  PERFORM 1 FROM public.coder_block_progress WHERE coder_id = v_coder FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.class_blocks
    WHERE id = '4bd91139-7b13-46ff-a768-b0c73e7d4f36'
      AND class_id = v_class AND status = 'CURRENT') THEN
    RAISE EXCEPTION 'Interactive class block changed; review again';
  END IF;
  SELECT count(*) INTO v_count FROM public.coder_block_progress
    WHERE coder_id = v_coder AND level_id = '1b7176fc-7da3-49f5-9899-af54ab466434';
  IF v_count <> 5 THEN RAISE EXCEPTION 'Unexpected progress row count'; END IF;

  -- Idempotent second run: preserve any later legitimate activity.
  IF NOT (EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE id = 'e3b4b11b-1293-432b-a562-9e78ae820921' AND status = 'IN_PROGRESS')
     AND NOT EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE coder_id = v_coder AND journey_order > 1 AND status <> 'PENDING')
     AND EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE id = '2bf3a002-fbcf-4b8d-9ff1-b4fb18c18623'
        AND status = 'COMPLETED' AND completion_source = 'MANUAL')) THEN
    SELECT count(*) INTO v_count FROM public.coder_block_progress
      WHERE coder_id = v_coder AND status = 'COMPLETED';
    IF v_count <> 5 THEN RAISE EXCEPTION 'Progress changed; review again'; END IF;

    UPDATE public.coder_block_progress
      SET status = (CASE WHEN journey_order = 0 THEN 'COMPLETED'
                        WHEN journey_order = 1 THEN 'IN_PROGRESS' ELSE 'PENDING' END)::public.coder_block_status_enum,
          completed_at = CASE WHEN journey_order = 0 THEN now() ELSE NULL END,
          completion_source = CASE WHEN journey_order = 0 THEN 'MANUAL' ELSE NULL END
      WHERE coder_id = v_coder AND level_id = '1b7176fc-7da3-49f5-9899-af54ab466434';
  END IF;

  IF v_cancel_stale_progression THEN
    UPDATE public.coder_level_progressions SET status = 'CANCELLED'
    WHERE id = v_progression AND status = 'WAITING_PLACEMENT';
  END IF;
END;
$repair$;
COMMIT;
