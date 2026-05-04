export function mergeCoachClassesById<T extends { id: string }>(ownClasses: T[], substituteClasses: T[]): T[] {
  const classMap = new Map<string, T>();
  ownClasses.forEach((klass) => classMap.set(klass.id, klass));
  substituteClasses.forEach((klass) => classMap.set(klass.id, klass));
  return Array.from(classMap.values());
}

export function pickRelevantCoachSessions<T extends { substitute_coach_id?: string | null }>(
  sessions: T[],
  isMainCoach: boolean,
  coachId: string,
): T[] {
  return isMainCoach ? sessions : sessions.filter((session) => session.substitute_coach_id === coachId);
}

export function pickNextCoachSession<T extends { date_time: string }>(
  sessions: T[],
  now: Date = new Date(),
): T | undefined {
  return sessions
    .filter((session) => new Date(session.date_time) >= now)
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];
}
