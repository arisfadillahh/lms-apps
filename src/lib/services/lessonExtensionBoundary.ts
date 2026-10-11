export type NextLessonSessionBoundary = {
  dateTime: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  hasAttendance: boolean;
};

/**
 * An extension inserts a new part immediately before the next lesson. The
 * source session may already be completed; only the first session of the next
 * lesson is a hard boundary because moving it after it has started would
 * rewrite a coder's live or historical lesson context.
 */
export function canExtendBeforeNextLessonSession(
  nextSession: NextLessonSessionBoundary | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!nextSession || nextSession.status === 'CANCELLED') return true;
  if (nextSession.hasAttendance || nextSession.status === 'COMPLETED') return false;

  const nextSessionAt = new Date(nextSession.dateTime).getTime();
  if (!Number.isFinite(nextSessionAt)) return false;

  return nextSessionAt > now.getTime();
}
