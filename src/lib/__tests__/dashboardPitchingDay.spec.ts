import { describe, expect, it } from 'vitest';

import { resolveDashboardPitchingDay } from '@/lib/services/dashboardPitchingDay';

describe('resolveDashboardPitchingDay', () => {
  it('uses the second-to-last lesson in a 19-lesson block', () => {
    const lessons = Array.from({ length: 19 }, (_, index) => ({
      session_id: index === 17 ? 'session-18' : null,
    }));

    expect(resolveDashboardPitchingDay({
      lessons,
      sessions: [{ id: 'session-18', date_time: '2026-01-18T10:00:00+07:00' }],
      now: new Date('2026-01-01T00:00:00+07:00'),
    })).toMatchObject({
      status: 'SCHEDULED',
      targetIndex: 17,
      totalLessons: 19,
      displayDate: '2026-01-18',
    });
  });

  it('uses the second-to-last lesson in a 17-lesson block', () => {
    const lessons = Array.from({ length: 17 }, (_, index) => ({
      session_id: index === 15 ? 'session-16' : null,
    }));

    expect(resolveDashboardPitchingDay({
      lessons,
      sessions: [{ id: 'session-16', date_time: '2026-02-16T10:00:00+07:00' }],
      now: new Date('2026-02-01T00:00:00+07:00'),
    })).toMatchObject({
      status: 'SCHEDULED',
      targetIndex: 15,
      totalLessons: 17,
      displayDate: '2026-02-16',
    });
  });

  it('returns an estimate when the pitching lesson has no generated session', () => {
    const lessons = Array.from({ length: 19 }, () => ({ session_id: null }));

    expect(resolveDashboardPitchingDay({ lessons, sessions: [], now: new Date('2026-03-01T00:00:00+07:00') })).toMatchObject({
      status: 'ESTIMATED',
      targetIndex: 17,
      totalLessons: 19,
      estimatedWeeks: 18,
      displayDate: null,
    });
  });

  it('estimates remaining weeks from lessons that already have past sessions', () => {
    const lessons = Array.from({ length: 19 }, (_, index) => ({
      session_id: index < 5 ? `session-${index + 1}` : null,
    }));
    const sessions = Array.from({ length: 5 }, (_, index) => ({
      id: `session-${index + 1}`,
      date_time: `2026-03-${String(index + 1).padStart(2, '0')}T10:00:00+07:00`,
    }));

    expect(resolveDashboardPitchingDay({
      lessons,
      sessions,
      now: new Date('2026-03-10T00:00:00+07:00'),
    })).toMatchObject({
      status: 'ESTIMATED',
      targetIndex: 17,
      estimatedWeeks: 13,
    });
  });
});
