export type AssignmentWindowLesson = {
  id: string;
  session_id: string | null;
};

export type AssignmentWindowSession = {
  id: string;
  date_time: string;
};

/** Keep saved links authoritative and infer only slots between their neighbours. */
export function mapSlotsBetweenAssignedSessions<T extends {
  globalIndex: number;
  explicitSessionId?: string | null;
}>(orderedSessions: ReadonlyArray<{ id: string }>, orderedSlots: readonly T[]): Map<string, T> {
  const activeIds = new Set(orderedSessions.map((session) => session.id));
  const explicit = new Map<string, T>();
  const available: T[] = [];
  for (const slot of orderedSlots) {
    if (slot.explicitSessionId && activeIds.has(slot.explicitSessionId)) {
      explicit.set(slot.explicitSessionId, slot);
    } else {
      available.push(slot);
    }
  }

  const nextAnchor = new Map<string, number>();
  let upper = Number.POSITIVE_INFINITY;
  for (const { id } of [...orderedSessions].reverse()) {
    nextAnchor.set(id, upper);
    upper = explicit.get(id)?.globalIndex ?? upper;
  }

  const result = new Map(explicit);
  const used = new Set<T>();
  let lower = -1;
  for (const { id } of orderedSessions) {
    const slot = explicit.get(id) ?? available.find((candidate) => (
      candidate.globalIndex > lower
      && candidate.globalIndex < (nextAnchor.get(id) ?? Number.POSITIVE_INFINITY)
      && !used.has(candidate)
    ));
    if (slot) {
      lower = slot.globalIndex;
      result.set(id, slot);
      used.add(slot);
    }
  }
  return result;
}

export type ForwardAssignmentWindow<
  TLesson extends AssignmentWindowLesson,
  TSession extends AssignmentWindowSession,
> = {
  lessonQueue: TLesson[];
  unassignedSessions: TSession[];
  frontierLessonId: string | null;
  frontierSessionId: string | null;
};

export function resolveForwardAssignmentBlocks<
  TBlock extends { id: string },
  TLesson extends { id: string },
>(
  orderedBlocks: TBlock[],
  lessonsByBlock: ReadonlyMap<string, TLesson[]>,
  frontierLessonId: string | null,
): TBlock[] {
  if (!frontierLessonId) return orderedBlocks;

  const frontierBlockIndex = orderedBlocks.findIndex((block) =>
    (lessonsByBlock.get(block.id) ?? []).some((lesson) => lesson.id === frontierLessonId),
  );

  return frontierBlockIndex >= 0 ? orderedBlocks.slice(frontierBlockIndex) : orderedBlocks;
}

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
