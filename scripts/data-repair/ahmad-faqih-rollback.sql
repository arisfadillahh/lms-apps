-- OPTIONAL rollback of apply.sql's block progress only. Never changes the
-- ACTIVE enrollment or WAITING_PLACEMENT progression. Requires unchanged
-- progression and no newer academic completion after apply.
BEGIN;
DO $rollback$
DECLARE
  v_coder uuid := 'afe24d5c-509d-43c1-951e-0a3f7d80ac39';
  v_count integer;
BEGIN
  PERFORM 1 FROM public.enrollments
    WHERE id = 'aa15cd14-e9d3-4ec9-9b93-5af2be1bad32'
      AND coder_id = v_coder AND status = 'ACTIVE' AND exit_reason IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment changed; review again'; END IF;
  PERFORM 1 FROM public.coder_level_progressions
    WHERE id = '6b1bbcca-1d20-46f5-86d4-5834da4f71c0'
      AND coder_id = v_coder AND status = 'WAITING_PLACEMENT'
      AND target_enrollment_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Progression changed; review again'; END IF;
  PERFORM 1 FROM public.coder_block_progress WHERE coder_id = v_coder FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.coder_block_progress
    WHERE coder_id = v_coder AND level_id = '1b7176fc-7da3-49f5-9899-af54ab466434';
  IF v_count <> 5 THEN RAISE EXCEPTION 'Unexpected progress row count'; END IF;
  IF (SELECT count(*) FROM public.coder_block_progress
      WHERE coder_id = v_coder AND status = 'COMPLETED') = 5 THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE id = 'e3b4b11b-1293-432b-a562-9e78ae820921' AND status = 'IN_PROGRESS') OR
     EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE coder_id = v_coder AND journey_order > 1 AND status <> 'PENDING') THEN
    RAISE EXCEPTION 'Learning progress changed; do not roll back blindly';
  END IF;
  UPDATE public.coder_block_progress SET status = 'COMPLETED', completion_source = NULL,
    completed_at = CASE id
      WHEN '2bf3a002-fbcf-4b8d-9ff1-b4fb18c18623' THEN '2026-09-12T12:00:31.339+00:00'::timestamptz
      WHEN 'e3b4b11b-1293-432b-a562-9e78ae820921' THEN '2026-09-12T12:00:33.816+00:00'::timestamptz
      WHEN '3125fdec-94dc-47de-a90d-72cd6f03a741' THEN '2026-09-19T09:00:04.03+00:00'::timestamptz
      WHEN '10975c71-b298-467f-b4df-f1bc854ab9e2' THEN '2026-09-26T09:00:04.543+00:00'::timestamptz
      WHEN '063572c9-88e1-4b00-b1a9-c66c025734c9' THEN '2026-10-03T08:29:48.676+00:00'::timestamptz END
    WHERE coder_id = v_coder AND level_id = '1b7176fc-7da3-49f5-9899-af54ab466434';
END;
$rollback$;
COMMIT;
