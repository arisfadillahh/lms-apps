import { describe, expect, it } from 'vitest';

import { resolveBlockProgress } from '@/lib/services/classBlockProgress';

const sessions = [
  { id: 'completed', date_time: '2026-08-29T08:30:00+07:00', status: 'COMPLETED' as const },
  { id: 'pitching', date_time: '2026-09-05T08:30:00+07:00', status: 'SCHEDULED' as const },
];

describe('resolveBlockProgress', () => {
  it('uses the actual next scheduled lesson when earlier lessons were intentionally skipped', () => {
    const result = resolveBlockProgress({
      lessons: [
        { title: 'Tutorial Part 2', order_index: 9002, session_id: 'completed' },
        { title: 'Poster Part 1', order_index: 10001, session_id: null },
        { title: 'Poster Part 2', order_index: 10002, session_id: null },
        { title: 'Latihan Presentasi', order_index: 11001, session_id: null },
        { title: 'Pitching Day', order_index: 12001, session_id: 'pitching' },
      ],
      sessions,
      nowMs: new Date('2026-09-01T00:00:00+07:00').getTime(),
    });

    expect(result.completedLessons).toBe(1);
    expect(result.nextLesson?.title).toBe('Pitching Day');
  });

  it('falls back to curriculum order when no future session has been assigned', () => {
    const result = resolveBlockProgress({
      lessons: [
        { title: 'Lesson 1', order_index: 1, session_id: 'completed' },
        { title: 'Lesson 2', order_index: 2, session_id: null },
      ],
      sessions: [sessions[0]],
    });

    expect(result.nextLesson?.title).toBe('Lesson 2');
  });
});
