export type ClassLessonSyncCandidate = {
  session_id: string | null;
  order_index?: number;
};

export type LessonSessionSnapshot = {
  id: string;
  date_time: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
};

export function hasLessonStarted(
  lessons: ClassLessonSyncCandidate[],
  sessionsById: ReadonlyMap<string, LessonSessionSnapshot>,
  now: Date = new Date(),
): boolean {
  const nowMs = now.getTime();

  return lessons.some((lesson) => {
    if (!lesson.session_id) return false;
    const session = sessionsById.get(lesson.session_id);
    if (!session || session.status === 'CANCELLED') return false;
    if (session.status === 'COMPLETED') return true;

    const sessionMs = new Date(session.date_time).getTime();
    return Number.isFinite(sessionMs) && sessionMs <= nowMs;
  });
}

export function hasClassReachedTemplate(
  templateOrderIndex: number,
  allBlockLessons: ClassLessonSyncCandidate[],
  sessionsById: ReadonlyMap<string, LessonSessionSnapshot>,
  now: Date = new Date(),
): boolean {
  const templateBoundary = templateOrderIndex * 1000;
  const lessonAndLater = allBlockLessons.filter(
    (lesson) => (lesson.order_index ?? Number.POSITIVE_INFINITY) >= templateBoundary,
  );

  return hasLessonStarted(lessonAndLater, sessionsById, now);
}
