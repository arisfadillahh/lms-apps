type ReminderClass = { type?: unknown } | null;

type ReminderSession = {
  classes?: ReminderClass | ReminderClass[];
};

function getReminderClass(session: ReminderSession): ReminderClass {
  return Array.isArray(session.classes) ? session.classes[0] ?? null : session.classes ?? null;
}

export function isWeeklyReminderClass(klass: ReminderClass): boolean {
  return klass?.type === 'WEEKLY';
}

/** Class-session reminders are intentionally limited to the Weekly program. */
export function filterWeeklyReminderSessions<T extends ReminderSession>(sessions: T[]): T[] {
  return sessions.filter((session) => isWeeklyReminderClass(getReminderClass(session)));
}
