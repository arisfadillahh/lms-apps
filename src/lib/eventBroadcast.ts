import { fromZonedTime } from 'date-fns-tz';

export const EVENT_TIME_ZONE = 'Asia/Jakarta';

export const EVENT_TEMPLATE_VARIABLES = [
  'event_name',
  'student_name',
  'date',
  'start_time',
  'end_time',
  'location',
  'address',
  'maps_url',
] as const;

export type EventTemplateVariable = (typeof EVENT_TEMPLATE_VARIABLES)[number];
export type EventReminderType = 'NOW' | 'H7' | 'H1';

export type EventTemplateValues = Record<EventTemplateVariable, string>;

export const DEFAULT_EVENT_MESSAGE_TEMPLATE = [
  '*Pengingat Event Clevio*',
  '',
  'Halo Ayah/Bunda dari *{student_name}*,',
  'Kami mengingatkan acara *{event_name}*:',
  '',
  'Tanggal: {date}',
  'Waktu: {start_time}{end_time}',
  'Tempat: {location}',
  '{address}',
  '{maps_url}',
  '',
  'Sampai bertemu di acara Clevio.',
].join('\n');

const templateVariablePattern = /\{([a-z_]+)\}/g;

export function findUnknownEventTemplateVariables(template: string): string[] {
  const allowed = new Set<string>(EVENT_TEMPLATE_VARIABLES);
  return [...new Set([...template.matchAll(templateVariablePattern)].map((match) => match[1]))]
    .filter((variable) => !allowed.has(variable));
}

export function renderEventMessage(template: string, values: EventTemplateValues): string {
  const unknown = findUnknownEventTemplateVariables(template);
  if (unknown.length > 0) {
    throw new Error(`Variabel template tidak dikenal: ${unknown.map((item) => `{${item}}`).join(', ')}`);
  }

  return template
    .replace(templateVariablePattern, (_match, variable: EventTemplateVariable) => values[variable] ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n')
    .trim();
}

export function formatEventDate(date: string): string {
  const value = new Date(`${date}T12:00:00+07:00`);
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: EVENT_TIME_ZONE,
  }).format(value);
}

export function formatEventTime(time: string): string {
  return `${time.slice(0, 5)} WIB`;
}

export function buildEventTemplateValues(input: {
  eventName: string;
  studentName: string;
  eventDate: string;
  startTime: string;
  endTime?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  locationMapsUrl?: string | null;
}): EventTemplateValues {
  return {
    event_name: input.eventName,
    student_name: input.studentName,
    date: formatEventDate(input.eventDate),
    start_time: formatEventTime(input.startTime),
    end_time: input.endTime ? ` – ${formatEventTime(input.endTime)}` : '',
    location: input.locationName?.trim() || '-',
    address: input.locationAddress?.trim() || '',
    maps_url: input.locationMapsUrl?.trim() || '',
  };
}

export function getEventReminderSchedule(input: {
  eventDate: string;
  reminderTime: string;
  reminderTypes: EventReminderType[];
  now?: Date;
}): Array<{ reminderType: EventReminderType; scheduledAt: string }> {
  const now = input.now ?? new Date();
  const base = fromZonedTime(`${input.eventDate}T${input.reminderTime}:00`, EVENT_TIME_ZONE);
  const dayMs = 24 * 60 * 60 * 1000;

  return input.reminderTypes.flatMap((reminderType) => {
    const scheduled = reminderType === 'NOW'
      ? now
      : new Date(base.getTime() - (reminderType === 'H7' ? 7 : 1) * dayMs);
    if (reminderType !== 'NOW' && scheduled.getTime() < now.getTime()) return [];
    return [{ reminderType, scheduledAt: scheduled.toISOString() }];
  });
}

export function buildEventPwaMessage(input: {
  eventDate: string;
  startTime: string;
  endTime?: string | null;
  locationName?: string | null;
}): string {
  const time = input.endTime
    ? `${formatEventTime(input.startTime)} – ${formatEventTime(input.endTime)}`
    : formatEventTime(input.startTime);
  return `${formatEventDate(input.eventDate)}, ${time}${input.locationName ? ` di ${input.locationName}` : ''}.`;
}
