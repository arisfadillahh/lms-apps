type ReminderClass = { type?: unknown; parent_whatsapp_enabled?: unknown } | null;

type ReminderSession = {
  classes?: ReminderClass | ReminderClass[];
};

function getReminderClass(session: ReminderSession): ReminderClass {
  return Array.isArray(session.classes) ? session.classes[0] ?? null : session.classes ?? null;
}

export function shouldSendParentWhatsappForClass(klass: ReminderClass): boolean {
  if (klass?.type === 'WEEKLY') return true;
  return klass?.type === 'EKSKUL' && klass.parent_whatsapp_enabled === true;
}

/** Only automatic parent WhatsApp messages are gated here. PWA/in-app notifications stay active. */
export function filterParentWhatsappReminderSessions<T extends ReminderSession>(sessions: T[]): T[] {
  return sessions.filter((session) => shouldSendParentWhatsappForClass(getReminderClass(session)));
}
