export const EVALUATION_LIVE_WINDOW_MS = 4 * 60 * 60 * 1000;

type EvaluationTiming = {
  status: string;
  createdAt: string;
  meetingAt?: string | null;
  meetingStatus?: string | null;
};

/** Never advance the shared presenter: catch-up is personal to the Coder. */
export function isCoderEvaluationSelfPaced(timing: EvaluationTiming, now: Date): boolean {
  if (timing.status === 'completed') return true;
  if (timing.status !== 'in_progress' || timing.meetingStatus !== 'COMPLETED') return false;
  const openedAt = Date.parse(timing.createdAt);
  const meetingAt = Date.parse(timing.meetingAt ?? '');
  if (!Number.isFinite(openedAt) || !Number.isFinite(meetingAt) || !Number.isFinite(now.getTime())) return false;
  return now.getTime() - Math.max(openedAt, meetingAt) >= EVALUATION_LIVE_WINDOW_MS;
}
