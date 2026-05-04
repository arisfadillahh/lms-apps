import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildClassReminderIdempotencyKey,
  buildInvoiceReminderIdempotencyKey,
  buildMakeupReminderIdempotencyKey,
  formatReminderDateKey,
} from '@/lib/services/reminderIdempotency';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('reminder idempotency keys', () => {
  it('uses target date and normalized parent phone for class reminders', () => {
    expect(buildClassReminderIdempotencyKey('2026-05-05', '+62 812-1202-2628')).toBe(
      'CLASS_REMINDER:2026-05-05:6281212022628',
    );
  });

  it('uses task id and reminder type for makeup reminders', () => {
    expect(buildMakeupReminderIdempotencyKey('task-1', 'H-3')).toBe('MAKEUP_REMINDER:task-1:H-3');
  });

  it('uses invoice id and local date for invoice reminders', () => {
    expect(buildInvoiceReminderIdempotencyKey('invoice-1', '2026-05-04')).toBe(
      'INVOICE_REMINDER:invoice-1:2026-05-04',
    );
  });

  it('formats date keys in the configured time zone', () => {
    expect(formatReminderDateKey(new Date('2026-05-04T17:30:00.000Z'), 'Asia/Jakarta')).toBe('2026-05-05');
  });
});

describe('reminder duplicate-send contracts', () => {
  it('checks WhatsApp logs before class reminders are sent', () => {
    const source = readSource('src/lib/services/classReminderScheduler.ts');

    expect(source).toContain('buildClassReminderIdempotencyKey(tomorrowStr, phone)');
    expect(source).toContain('sentReminderKeys.has(idempotencyKey)');
    expect(source).toContain("sendClassReminder(phone, msg, data.students.join(', '), 'CLASS_REMINDER', data.idempotencyKey)");
  });

  it('checks task and reminder type before makeup reminders are sent', () => {
    const source = readSource('src/app/api/jobs/reminders/makeup-d2/route.ts');

    expect(source).toContain('buildMakeupReminderIdempotencyKey(task.id, window.label)');
    expect(source).toContain('reportsDao.hasWhatsappLogWithIdempotencyKey(idempotencyKey)');
    expect(source).toContain("status: 'SKIPPED_DUPLICATE'");
  });

  it('checks invoice reminders before sending WhatsApp messages', () => {
    const source = readSource('src/lib/services/whatsappClient.ts');

    expect(source).toContain('buildInvoiceReminderIdempotencyKey(invoice.id)');
    expect(source).toContain('hasWhatsappLogWithIdempotencyKey(idempotencyKey)');
    expect(source).toContain('idempotency_key: idempotencyKey');
  });
});
