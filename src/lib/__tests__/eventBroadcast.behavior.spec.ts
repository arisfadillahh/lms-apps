import { describe, expect, it } from 'vitest';

import {
  buildEventTemplateValues,
  findUnknownEventTemplateVariables,
  getEventReminderSchedule,
  renderEventMessage,
} from '@/lib/eventBroadcast';
import { shouldSendParentWhatsappForClass } from '@/lib/classReminderEligibility';
import { publishReportWithOptionalWhatsapp } from '@/lib/reportPublication';

describe('Ekskul parent WhatsApp policy', () => {
  const enabledClass = {
    type: 'EKSKUL',
    parent_whatsapp_enabled: true,
    parent_whatsapp_report_enabled: true,
    parent_whatsapp_event_enabled: true,
  };

  it('requires both the school policy and the matching per-message toggle', () => {
    expect(shouldSendParentWhatsappForClass(enabledClass, 'REPORT')).toBe(true);
    expect(shouldSendParentWhatsappForClass(enabledClass, 'EVENT')).toBe(true);
    expect(shouldSendParentWhatsappForClass({ ...enabledClass, parent_whatsapp_enabled: false }, 'REPORT')).toBe(false);
    expect(shouldSendParentWhatsappForClass({ ...enabledClass, parent_whatsapp_event_enabled: false }, 'EVENT')).toBe(false);
  });

  it('preserves the existing always-on Weekly policy', () => {
    expect(shouldSendParentWhatsappForClass({ type: 'WEEKLY' }, 'REPORT')).toBe(true);
  });
});

describe('event reminder schedule boundaries', () => {
  const eventDate = '2026-09-10';
  const reminderTime = '10:00';

  it('keeps an H-7 reminder immediately before and exactly at its due time', () => {
    expect(getEventReminderSchedule({
      eventDate,
      reminderTime,
      reminderTypes: ['H7'],
      now: new Date('2026-09-03T02:59:59.999Z'),
    })).toEqual([{ reminderType: 'H7', scheduledAt: '2026-09-03T03:00:00.000Z' }]);

    expect(getEventReminderSchedule({
      eventDate,
      reminderTime,
      reminderTypes: ['H7'],
      now: new Date('2026-09-03T03:00:00.000Z'),
    })).toEqual([{ reminderType: 'H7', scheduledAt: '2026-09-03T03:00:00.000Z' }]);
  });

  it('drops a scheduled reminder after its boundary but always keeps send-now', () => {
    expect(getEventReminderSchedule({
      eventDate,
      reminderTime,
      reminderTypes: ['H7', 'NOW'],
      now: new Date('2026-09-03T03:00:00.001Z'),
    })).toEqual([{ reminderType: 'NOW', scheduledAt: '2026-09-03T03:00:00.001Z' }]);
  });
});

describe('WhatsApp-safe event template', () => {
  it('renders real newlines and structured event values', () => {
    const message = renderEventMessage(
      '*{event_name}*\nUntuk {student_name}\n{date}\n{start_time}{end_time}\n{location}\n{maps_url}',
      buildEventTemplateValues({
        eventName: 'Festival Coder',
        studentName: 'Alya',
        eventDate: '2026-09-10',
        startTime: '09:00',
        endTime: '12:00',
        locationName: 'Clevio Bukit Golf',
        locationMapsUrl: 'https://maps.google.com/example',
      }),
    );

    expect(message).toBe('*Festival Coder*\nUntuk Alya\nKamis, 10 September 2026\n09:00 WIB – 12:00 WIB\nClevio Bukit Golf\nhttps://maps.google.com/example');
    expect(message).not.toContain('\\n');
  });

  it('reports unknown variables before an event is saved', () => {
    expect(findUnknownEventTemplateVariables('Halo {student_name}, {unknown_value}')).toEqual(['unknown_value']);
  });
});

describe('report publication delivery ordering', () => {
  it('publishes and notifies Coder without calling WhatsApp when school policy blocks it', async () => {
    const calls: string[] = [];
    const result = await publishReportWithOptionalWhatsapp({
      shouldSendWhatsapp: false,
      hasParentPhone: true,
      now: () => '2026-08-27T10:00:00.000Z',
      publish: async (delivery) => { calls.push(`publish:${delivery.sent_via_whatsapp}`); },
      notifyCoder: async () => { calls.push('pwa'); },
      createWhatsappLog: async () => { calls.push('log'); return { id: 'log-1' }; },
      sendWhatsapp: async () => { calls.push('wa'); return { success: true }; },
      updateWhatsappLog: async () => { calls.push('log-update'); },
    });

    expect(calls).toEqual(['publish:false', 'pwa']);
    expect(result).toEqual({ whatsappStatus: 'SKIPPED_POLICY', sentAt: null });
  });

  it('never marks WhatsApp sent when the provider returns success false', async () => {
    const calls: string[] = [];
    const result = await publishReportWithOptionalWhatsapp({
      shouldSendWhatsapp: true,
      hasParentPhone: true,
      now: () => '2026-08-27T10:00:00.000Z',
      publish: async (delivery) => { calls.push(`publish:${delivery.sent_via_whatsapp}`); },
      notifyCoder: async () => { calls.push('pwa'); },
      createWhatsappLog: async () => { calls.push('log'); return { id: 'log-1' }; },
      sendWhatsapp: async () => { calls.push('wa'); return { success: false, error: 'offline' }; },
      updateWhatsappLog: async (_id, status) => { calls.push(`log:${status}`); },
    });

    expect(calls).toEqual(['publish:false', 'pwa', 'log', 'wa', 'log:FAILED']);
    expect(result).toEqual({ whatsappStatus: 'FAILED', sentAt: null, warning: 'offline' });
  });

  it('sets sent metadata only after a real successful delivery', async () => {
    const calls: string[] = [];
    const result = await publishReportWithOptionalWhatsapp({
      shouldSendWhatsapp: true,
      hasParentPhone: true,
      now: () => '2026-08-27T10:00:00.000Z',
      publish: async (delivery) => { calls.push(`publish:${delivery.sent_via_whatsapp}`); },
      notifyCoder: async () => { calls.push('pwa'); },
      createWhatsappLog: async () => { calls.push('log'); return { id: 'log-1' }; },
      sendWhatsapp: async () => { calls.push('wa'); return { success: true }; },
      updateWhatsappLog: async (_id, status) => { calls.push(`log:${status}`); },
    });

    expect(calls).toEqual(['publish:false', 'pwa', 'log', 'wa', 'publish:true', 'log:SENT']);
    expect(result).toEqual({ whatsappStatus: 'SENT', sentAt: '2026-08-27T10:00:00.000Z' });
  });
});
