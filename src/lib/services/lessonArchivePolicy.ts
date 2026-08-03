export type ArchiveCandidate = {
  blockStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
  hasMakeUpTask: boolean;
  sessionDateTime: string | null;
  sessionStatus: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | null;
};

export function shouldPreserveArchivedClassLesson(
  candidate: ArchiveCandidate,
  now = new Date(),
): boolean {
  if (candidate.hasMakeUpTask || candidate.blockStatus === 'COMPLETED') return true;
  if (candidate.sessionStatus === 'COMPLETED') return true;
  if (candidate.sessionDateTime && new Date(candidate.sessionDateTime) <= now) return true;
  return false;
}
