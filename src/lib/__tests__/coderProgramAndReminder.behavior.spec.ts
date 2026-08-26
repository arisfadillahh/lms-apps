import { describe, expect, it } from 'vitest';

import { resolveCoderProgram } from '@/lib/coderProgram';
import { filterWeeklyReminderSessions } from '@/lib/classReminderEligibility';

describe('coder program and class reminder behavior', () => {
  it('does not infer a coder program from a phone number', () => {
    expect(resolveCoderProgram(null, 'EKSKUL')).toBe('EKSKUL');
    expect(resolveCoderProgram(null, null)).toBeNull();
  });

  it('prefers an explicit program over the active class fallback', () => {
    expect(resolveCoderProgram('EKSKUL', 'WEEKLY')).toBe('EKSKUL');
  });

  it('returns only Weekly sessions for class reminders', () => {
    const sessions = [
      { id: 'weekly', classes: { type: 'WEEKLY' } },
      { id: 'ekskul', classes: { type: 'EKSKUL' } },
      { id: 'unknown', classes: null },
    ];

    expect(filterWeeklyReminderSessions(sessions).map((session) => session.id)).toEqual(['weekly']);
  });
});
