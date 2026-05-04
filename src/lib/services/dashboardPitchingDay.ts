type DashboardPitchingLesson = {
  session_id: string | null;
};

type DashboardPitchingSession = {
  id: string;
  date_time: string;
};

function formatDateOnly(dateTime: string): string {
  return new Date(dateTime).toISOString().slice(0, 10);
}

export function resolveDashboardPitchingDay({
  lessons,
  sessions,
  now = new Date(),
}: {
  lessons: DashboardPitchingLesson[];
  sessions: DashboardPitchingSession[];
  now?: Date;
}) {
  if (lessons.length === 0) {
    return null;
  }

  const sessionMap = new Map(sessions.map((session) => [session.id, session.date_time]));
  const targetIndex = Math.max(lessons.length - 2, 0);
  const targetLesson = lessons[targetIndex];
  const sessionDate = targetLesson.session_id ? sessionMap.get(targetLesson.session_id) : undefined;
  const completedLessonCount = lessons.filter((lesson) => {
    if (!lesson.session_id) return false;
    const dateTime = sessionMap.get(lesson.session_id);
    return dateTime ? new Date(dateTime) < now : false;
  }).length;

  if (sessionDate) {
    return {
      status: 'SCHEDULED' as const,
      targetIndex,
      totalLessons: lessons.length,
      sessionDate,
      displayDate: formatDateOnly(sessionDate),
      estimatedWeeks: Math.max(targetIndex + 1 - completedLessonCount, 0),
    };
  }

  return {
    status: 'ESTIMATED' as const,
    targetIndex,
    totalLessons: lessons.length,
    sessionDate: null,
    displayDate: null,
    estimatedWeeks: Math.max(targetIndex + 1 - completedLessonCount, 0),
  };
}
