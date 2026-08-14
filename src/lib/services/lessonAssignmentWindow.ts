export type AssignmentWindowLesson = {
  id: string;
  session_id: string | null;
};

export type AssignmentWindowSession = {
  id: string;
  date_time: string;
};

export type ForwardAssignmentWindow<
  TLesson extends AssignmentWindowLesson,
  TSession extends AssignmentWindowSession,
> = {
  lessonQueue: TLesson[];
  unassignedSessions: TSession[];
  frontierLessonId: string | null;
  frontierSessionId: string | null;
};

/**
 * Keeps completed/manual history immutable and only fills the schedule after the
 * latest session that already owns a lesson. Old holes are intentionally ignored.
 */
export function resolveForwardAssignmentWindow<
  TLesson extends AssignmentWindowLesson,
  TSession extends AssignmentWindowSession,
>(orderedLessons: TLesson[], sessions: TSession[]): ForwardAssignmentWindow<TLesson, TSession> {
  const orderedSessions = sessions
    .slice()
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const sessionIndex = new Map(orderedSessions.map((session, index) => [session.id, index]));

  let frontierSessionIndex = -1;
  let frontierLessonIndex = -1;

  orderedLessons.forEach((lesson, lessonIndex) => {
    if (!lesson.session_id) return;
    const assignedSessionIndex = sessionIndex.get(lesson.session_id);
    if (assignedSessionIndex === undefined || assignedSessionIndex <= frontierSessionIndex) return;

    frontierSessionIndex = assignedSessionIndex;
    frontierLessonIndex = lessonIndex;
  });

  const assignedSessionIds = new Set(
    orderedLessons.flatMap((lesson) => (lesson.session_id ? [lesson.session_id] : [])),
  );

  return {
    lessonQueue: orderedLessons
      .slice(frontierLessonIndex + 1)
      .filter((lesson) => !lesson.session_id),
    unassignedSessions: orderedSessions
      .slice(frontierSessionIndex + 1)
      .filter((session) => !assignedSessionIds.has(session.id)),
    frontierLessonId: frontierLessonIndex >= 0 ? orderedLessons[frontierLessonIndex].id : null,
    frontierSessionId: frontierSessionIndex >= 0 ? orderedSessions[frontierSessionIndex].id : null,
  };
}
