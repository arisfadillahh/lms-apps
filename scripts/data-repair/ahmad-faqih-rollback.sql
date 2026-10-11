-- REVIEW ONLY. Reverse the exact apply.sql result, if no new learning activity
-- or placement happened after apply. Original reviewed baseline was ACTIVE.
BEGIN;
DO $rollback$
DECLARE
  v_coder uuid := 'afe24d5c-509d-43c1-951e-0a3f7d80ac39';
  v_enrollment uuid := 'aa15cd14-e9d3-4ec9-9b93-5af2be1bad32';
BEGIN
  IF EXISTS (SELECT 1 FROM public.coder_level_progressions
    WHERE id = '6b1bbcca-1d20-46f5-86d4-5834da4f71c0') THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enrollments WHERE id = v_enrollment
      AND coder_id = v_coder AND status = 'ACTIVE') OR
     NOT EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE id = 'e3b4b11b-1293-432b-a562-9e78ae820921' AND status = 'IN_PROGRESS') OR
     EXISTS (SELECT 1 FROM public.coder_block_progress
      WHERE coder_id = v_coder AND journey_order > 1 AND status <> 'PENDING') THEN
    RAISE EXCEPTION 'State changed since repair; do not roll back blindly';
  END IF;
  UPDATE public.coder_block_progress SET status = 'COMPLETED', completion_source = NULL,
    completed_at = CASE id
      WHEN 'e3b4b11b-1293-432b-a562-9e78ae820921' THEN '2026-09-12T12:00:33.816+00:00'::timestamptz
      WHEN '3125fdec-94dc-47de-a90d-72cd6f03a741' THEN '2026-09-19T09:00:04.03+00:00'::timestamptz
      WHEN '10975c71-b298-467f-b4df-f1bc854ab9e2' THEN '2026-09-26T09:00:04.543+00:00'::timestamptz
      WHEN '063572c9-88e1-4b00-b1a9-c66c025734c9' THEN '2026-10-03T08:29:48.676+00:00'::timestamptz END
    WHERE id IN ('e3b4b11b-1293-432b-a562-9e78ae820921',
      '3125fdec-94dc-47de-a90d-72cd6f03a741',
      '10975c71-b298-467f-b4df-f1bc854ab9e2',
      '063572c9-88e1-4b00-b1a9-c66c025734c9');
  INSERT INTO public.coder_level_progressions
    (id,coder_id,source_level_id,target_level_id,source_class_id,source_enrollment_id,
     status,completed_at,created_at,updated_at)
    VALUES ('6b1bbcca-1d20-46f5-86d4-5834da4f71c0',v_coder,
      '1b7176fc-7da3-49f5-9899-af54ab466434','9c4c5a7e-ec28-4ca9-8621-c50147997fe7',
      'f300247f-4a3d-4bde-8d13-57251b99f2ea',v_enrollment,'WAITING_PLACEMENT',
      '2026-10-03T08:29:48.798501+00:00','2026-10-03T08:29:48.798501+00:00',
      '2026-10-03T08:29:48.798501+00:00');
END;
$rollback$;
COMMIT;
