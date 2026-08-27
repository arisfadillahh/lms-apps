export type ParentWhatsappNotificationType = 'CLASS_REMINDER' | 'ABSENCE' | 'MAKEUP_REMINDER';

type ReminderClass = {
  type?: unknown;
  parent_whatsapp_class_reminder_enabled?: unknown;
  parent_whatsapp_absence_enabled?: unknown;
  parent_whatsapp_makeup_enabled?: unknown;
} | null;

type ReminderSession = {
  classes?: ReminderClass | ReminderClass[];
};

function getReminderClass(session: ReminderSession): ReminderClass {
  return Array.isArray(session.classes) ? session.classes[0] ?? null : session.classes ?? null;
}

const notificationSettingByType = {
  CLASS_REMINDER: 'parent_whatsapp_class_reminder_enabled',
  ABSENCE: 'parent_whatsapp_absence_enabled',
  MAKEUP_REMINDER: 'parent_whatsapp_makeup_enabled',
} as const satisfies Record<ParentWhatsappNotificationType, keyof NonNullable<ReminderClass>>;

export function shouldSendParentWhatsappForClass(
  klass: ReminderClass,
  notificationType: ParentWhatsappNotificationType,
): boolean {
  if (klass?.type === 'WEEKLY') return true;
  return klass?.type === 'EKSKUL' && klass[notificationSettingByType[notificationType]] === true;
}

/** Only automatic parent WhatsApp messages are gated here. PWA/in-app notifications stay active. */
export function filterParentWhatsappReminderSessions<T extends ReminderSession>(
  sessions: T[],
  notificationType: ParentWhatsappNotificationType,
): T[] {
  return sessions.filter((session) => shouldSendParentWhatsappForClass(getReminderClass(session), notificationType));
}
