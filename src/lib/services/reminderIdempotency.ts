const DEFAULT_TIME_ZONE = 'Asia/Jakarta';

function cleanKeyPart(value: string): string {
  return value.trim().replace(/\s+/g, '-');
}

export function normalizeReminderPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function formatReminderDateKey(date = new Date(), timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function buildClassReminderIdempotencyKey(targetDate: string, parentPhone: string): string {
  return `CLASS_REMINDER:${cleanKeyPart(targetDate)}:${normalizeReminderPhone(parentPhone)}`;
}

export function buildMakeupReminderIdempotencyKey(taskId: string, reminderType: 'H-3' | 'H-1'): string {
  return `MAKEUP_REMINDER:${cleanKeyPart(taskId)}:${reminderType}`;
}

export function buildInvoiceReminderIdempotencyKey(invoiceId: string, dateKey = formatReminderDateKey()): string {
  return `INVOICE_REMINDER:${cleanKeyPart(invoiceId)}:${dateKey}`;
}
