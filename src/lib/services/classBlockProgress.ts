export type BlockProgressLesson = {
  title: string;
  order_index: number;
  session_id: string | null;
};

export type BlockProgressSession = {
  id: string;
  date_time: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
};

export function resolveBlockProgress<TLesson extends BlockProgressLesson>({
  lessons,
  sessions,
  nowMs = Date.now(),
}: {
  lessons: TLesson[];
  sessions: BlockProgressSession[];
  nowMs?: number;
}) {
  const sortedLessons = [...lessons].sort((left, right) => left.order_index - right.order_index);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  let lastCompletedIndex = -1;

  for (let index = 0; index < sortedLessons.length; index += 1) {
    const sessionId = sortedLessons[index].session_id;
    if (sessionId && sessionById.get(sessionId)?.status === 'COMPLETED') {
      lastCompletedIndex = index;
    }
  }

  const nextScheduledLesson = sortedLessons
    .flatMap((lesson) => {
      const session = lesson.session_id ? sessionById.get(lesson.session_id) : null;
      if (!session || session.status !== 'SCHEDULED' || new Date(session.date_time).getTime() < nowMs) return [];
      return [{ lesson, dateTimeMs: new Date(session.date_time).getTime() }];
    })
    .sort((left, right) => left.dateTimeMs - right.dateTimeMs)[0]?.lesson;

  return {
    sortedLessons,
    completedLessons: lastCompletedIndex + 1,
    nextLesson: nextScheduledLesson ?? sortedLessons[lastCompletedIndex + 1] ?? null,
  };
}
