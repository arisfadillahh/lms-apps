import type { ClassDeliveryDetails } from '@/lib/classDelivery';

export const CLASS_REMINDER_TEMPLATE_CATEGORIES = [
  'CLASS_REMINDER_ONLINE',
  'CLASS_REMINDER_OFFLINE',
] as const;

export type ClassReminderTemplateCategory = (typeof CLASS_REMINDER_TEMPLATE_CATEGORIES)[number];

export const CLASS_REMINDER_TEMPLATE_VARIABLES = [
  'parent_name',
  'student_name',
  'class_name',
  'time',
  'zoom_link',
  'delivery_mode',
  'location_name',
  'location_address',
  'maps_url',
] as const;

export const DEFAULT_CLASS_REMINDER_TEMPLATES: Record<ClassReminderTemplateCategory, {
  label: string;
  description: string;
  content: string;
}> = {
  CLASS_REMINDER_ONLINE: {
    label: 'Reminder Kelas Online',
    description: 'Template untuk kelas yang berlangsung melalui Zoom atau link kelas online.',
    content: `Halo Ayah/Bunda {parent_name} 👋

Mengingatkan jadwal kelas coding:
💻 Coder: {student_name}
📚 Kelas: {class_name}
🕒 Waktu: {time} WIB
🔗 Link kelas: {zoom_link}

Mohon hadir tepat waktu ya. Terima kasih! 🙏`,
  },
  CLASS_REMINDER_OFFLINE: {
    label: 'Reminder Kelas Offline',
    description: 'Template untuk kelas tatap muka. Sertakan nama lokasi, alamat, atau Google Maps bila tersedia.',
    content: `Halo Ayah/Bunda {parent_name} 👋

Mengingatkan jadwal kelas coding:
💻 Coder: {student_name}
📚 Kelas: {class_name}
🕒 Waktu: {time} WIB
📍 Lokasi: {location_name}
🏠 Alamat: {location_address}
🗺️ Google Maps: {maps_url}

Mohon hadir tepat waktu dan siapkan perjalanan ya. Terima kasih! 🙏`,
  },
};

export function getClassReminderTemplateCategory(
  klass: Pick<ClassDeliveryDetails, 'delivery_mode'> | null | undefined,
): ClassReminderTemplateCategory {
  return klass?.delivery_mode === 'OFFLINE'
    ? 'CLASS_REMINDER_OFFLINE'
    : 'CLASS_REMINDER_ONLINE';
}

export function resolveClassReminderTemplate(
  klass: Pick<ClassDeliveryDetails, 'delivery_mode'> | null | undefined,
  templates: Partial<Record<ClassReminderTemplateCategory, string>> = {},
  legacyTemplate?: string | null,
): string {
  const category = getClassReminderTemplateCategory(klass);
  const configured = templates[category]?.trim();
  if (configured) return configured;

  // Preserve a previously customised legacy template for Online reminders while
  // giving Offline classes a safe location-aware default.
  if (category === 'CLASS_REMINDER_ONLINE' && legacyTemplate?.trim()) {
    return legacyTemplate.trim();
  }

  return DEFAULT_CLASS_REMINDER_TEMPLATES[category].content;
}
