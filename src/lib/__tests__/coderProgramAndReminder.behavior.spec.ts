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

  it('keeps Weekly enabled and makes Ekskul parent WhatsApp explicitly opt-in', () => {
    const sessions = [
      { id: 'weekly', classes: { type: 'WEEKLY' } },
      { id: 'ekskul-off', classes: { type: 'EKSKUL', parent_whatsapp_enabled: false } },
      { id: 'ekskul-on', classes: { type: 'EKSKUL', parent_whatsapp_enabled: true } },
      { id: 'unknown', classes: null },
    ];

    expect(filterParentWhatsappReminderSessions(sessions).map((session) => session.id)).toEqual(['weekly', 'ekskul-on']);
    expect(shouldSendParentWhatsappForClass({ type: 'EKSKUL' })).toBe(false);
  });
});
