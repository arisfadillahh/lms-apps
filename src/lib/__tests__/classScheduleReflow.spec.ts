import { describe, expect, it } from 'vitest';

import { buildRecurringScheduleUpdates } from '@/lib/services/classScheduleReflow';

const NOW = new Date('2026-09-01T00:00:00+07:00').getTime();

describe('buildRecurringScheduleUpdates', () => {
  it('keeps colliding lessons in curriculum order and one week apart', () => {
    const updates = buildRecurringScheduleUpdates({
      sessions: [
        { id: 'pitching', dateTime: '2026-09-05T08:30:00+07:00', curriculumOrder: '2026-07-01:12001' },
        { id: 'poster-1', dateTime: '2026-09-05T08:30:00+07:00', curriculumOrder: '2026-07-01:10001' },
        { id: 'presentation', dateTime: '2026-09-05T08:30:00+07:00', curriculumOrder: '2026-07-01:11001' },
        { id: 'poster-2', dateTime: '2026-09-05T08:30:00+07:00', curriculumOrder: '2026-07-01:10002' },
      ],
      targetDayIndex: 6,
      targetTime: '08:30',
      nowMs: NOW,
    });

    expect(updates).toEqual([
      { id: 'poster-1', dateTime: '2026-09-05T08:30:00+07:00' },
      { id: 'poster-2', dateTime: '2026-09-12T08:30:00+07:00' },
      { id: 'presentation', dateTime: '2026-09-19T08:30:00+07:00' },
      { id: 'pitching', dateTime: '2026-09-26T08:30:00+07:00' },
    ]);
  });

  it('cascades later sessions instead of creating another duplicate date', () => {
    const updates = buildRecurringScheduleUpdates({
      sessions: [
        { id: 'one', dateTime: '2026-09-05T15:00:00+07:00', curriculumOrder: '1' },
        { id: 'two', dateTime: '2026-09-05T15:00:00+07:00', curriculumOrder: '2' },
        { id: 'three', dateTime: '2026-09-12T15:00:00+07:00', curriculumOrder: '3' },
      ],
      targetDayIndex: 6,
      targetTime: '15:00:00',
      nowMs: NOW,
    });

    expect(updates.map((update) => update.dateTime)).toEqual([
      '2026-09-05T15:00:00+07:00',
      '2026-09-12T15:00:00+07:00',
      '2026-09-19T15:00:00+07:00',
    ]);
  });

  it('preserves intentional multi-week gaps', () => {
    const updates = buildRecurringScheduleUpdates({
      sessions: [
        { id: 'before-break', dateTime: '2026-09-05T08:30:00+07:00' },
        { id: 'after-break', dateTime: '2026-09-26T08:30:00+07:00' },
      ],
      targetDayIndex: 6,
      targetTime: '08:30',
      nowMs: NOW,
    });

    expect(updates[1].dateTime).toBe('2026-09-26T08:30:00+07:00');
  });

  it('uses the WIB calendar weekday for early-morning classes', () => {
    const updates = buildRecurringScheduleUpdates({
      sessions: [{ id: 'early', dateTime: '2026-09-04T18:00:00+00:00' }],
      targetDayIndex: 6,
      targetTime: '01:00',
      nowMs: NOW,
    });

    expect(updates[0].dateTime).toBe('2026-09-05T01:00:00+07:00');
  });
});
