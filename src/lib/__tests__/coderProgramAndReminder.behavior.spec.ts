import { describe, expect, it } from 'vitest';

import { resolveCoderProgram } from '@/lib/coderProgram';
import { filterParentWhatsappReminderSessions, shouldSendParentWhatsappForClass } from '@/lib/classReminderEligibility';

describe('coder program and class reminder behavior', () => {
  it('does not infer a coder program from a phone number', () => {
    expect(resolveCoderProgram(null, 'EKSKUL')).toBe('EKSKUL');
    expect(resolveCoderProgram(null, null)).toBeNull();
  });

  it('prefers an explicit program over the active class fallback', () => {
    expect(resolveCoderProgram('EKSKUL', 'WEEKLY')).toBe('EKSKUL');
  });

  it('keeps every Weekly parent WhatsApp type enabled by program policy', () => {
    const weeklyClass = { type: 'WEEKLY' };

    expect(shouldSendParentWhatsappForClass(weeklyClass, 'CLASS_REMINDER')).toBe(true);
    expect(shouldSendParentWhatsappForClass(weeklyClass, 'ABSENCE')).toBe(true);
    expect(shouldSendParentWhatsappForClass(weeklyClass, 'MAKEUP_REMINDER')).toBe(true);
  });

  it('gates each Ekskul parent WhatsApp type independently', () => {
    const allDisabled = {
      type: 'EKSKUL',
      parent_whatsapp_enabled: true,
      parent_whatsapp_class_reminder_enabled: false,
      parent_whatsapp_absence_enabled: false,
      parent_whatsapp_makeup_enabled: false,
    };
    const scheduleOnly = { ...allDisabled, parent_whatsapp_class_reminder_enabled: true };
    const absenceOnly = { ...allDisabled, parent_whatsapp_absence_enabled: true };
    const makeupOnly = { ...allDisabled, parent_whatsapp_makeup_enabled: true };

    expect([
      shouldSendParentWhatsappForClass(allDisabled, 'CLASS_REMINDER'),
      shouldSendParentWhatsappForClass(allDisabled, 'ABSENCE'),
      shouldSendParentWhatsappForClass(allDisabled, 'MAKEUP_REMINDER'),
    ]).toEqual([false, false, false]);
    expect([
      shouldSendParentWhatsappForClass(scheduleOnly, 'CLASS_REMINDER'),
      shouldSendParentWhatsappForClass(scheduleOnly, 'ABSENCE'),
      shouldSendParentWhatsappForClass(scheduleOnly, 'MAKEUP_REMINDER'),
    ]).toEqual([true, false, false]);
    expect([
      shouldSendParentWhatsappForClass(absenceOnly, 'CLASS_REMINDER'),
      shouldSendParentWhatsappForClass(absenceOnly, 'ABSENCE'),
      shouldSendParentWhatsappForClass(absenceOnly, 'MAKEUP_REMINDER'),
    ]).toEqual([false, true, false]);
    expect([
      shouldSendParentWhatsappForClass(makeupOnly, 'CLASS_REMINDER'),
      shouldSendParentWhatsappForClass(makeupOnly, 'ABSENCE'),
      shouldSendParentWhatsappForClass(makeupOnly, 'MAKEUP_REMINDER'),
    ]).toEqual([false, false, true]);
  });

  it('filters schedule reminders without leaking absence or makeup consent', () => {
    const sessions = [
      { id: 'weekly', classes: { type: 'WEEKLY' } },
      { id: 'schedule', classes: { type: 'EKSKUL', parent_whatsapp_enabled: true, parent_whatsapp_class_reminder_enabled: true } },
      { id: 'absence', classes: { type: 'EKSKUL', parent_whatsapp_enabled: true, parent_whatsapp_absence_enabled: true } },
      { id: 'makeup', classes: { type: 'EKSKUL', parent_whatsapp_enabled: true, parent_whatsapp_makeup_enabled: true } },
      { id: 'unknown', classes: null },
    ];

    expect(filterParentWhatsappReminderSessions(sessions, 'CLASS_REMINDER').map((session) => session.id)).toEqual(['weekly', 'schedule']);
    expect(filterParentWhatsappReminderSessions(sessions, 'ABSENCE').map((session) => session.id)).toEqual(['weekly', 'absence']);
    expect(filterParentWhatsappReminderSessions(sessions, 'MAKEUP_REMINDER').map((session) => session.id)).toEqual(['weekly', 'makeup']);
    expect(shouldSendParentWhatsappForClass({ type: 'EKSKUL' }, 'CLASS_REMINDER')).toBe(false);
  });
});
