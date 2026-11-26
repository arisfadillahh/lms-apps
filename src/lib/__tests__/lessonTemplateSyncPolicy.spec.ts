import { describe, expect, it } from 'vitest';

import {
  hasClassReachedTemplate,
  hasLessonStarted,
  usesArchivedLessonPlan,
  type LessonSessionSnapshot,
} from '@/lib/lessonTemplateSyncPolicy';

const now = new Date('2026-09-02T00:00:00.000Z');

function sessions(...items: LessonSessionSnapshot[]) {
  return new Map(items.map((item) => [item.id, item]));
}

describe('lesson template sync snapshot policy', () => {
  it('keeps a pinned plan separate from shared curriculum edits', () => {
    const pinned = { lesson_templates: { is_archived: true } };
    const shared = { lesson_templates: { is_archived: false } };

    expect(usesArchivedLessonPlan([pinned, pinned])).toBe(true);
    expect(usesArchivedLessonPlan([pinned, shared])).toBe(false);
    expect(usesArchivedLessonPlan([pinned, { lesson_templates: null }])).toBe(false);
    expect(usesArchivedLessonPlan([])).toBe(false);
  });

  it('allows synchronization before the lesson starts', () => {
    expect(hasLessonStarted(
      [{ session_id: 'future' }],
      sessions({ id: 'future', date_time: '2026-09-05T01:30:00.000Z', status: 'SCHEDULED' }),
      now,
    )).toBe(false);
  });

  it('freezes every part after the first part starts', () => {
    expect(hasLessonStarted(
      [{ session_id: 'past' }, { session_id: 'future' }],
      sessions(
        { id: 'past', date_time: '2026-08-29T01:30:00.000Z', status: 'COMPLETED' },
        { id: 'future', date_time: '2026-09-05T01:30:00.000Z', status: 'SCHEDULED' },
      ),
      now,
    )).toBe(true);
  });

  it('does not treat a cancelled assignment as started', () => {
    expect(hasLessonStarted(
      [{ session_id: 'cancelled' }],
      sessions({ id: 'cancelled', date_time: '2026-08-29T01:30:00.000Z', status: 'CANCELLED' }),
      now,
    )).toBe(false);
  });

  it('does not insert a newly created lesson behind class progress', () => {
    expect(hasClassReachedTemplate(
      2,
      [{ session_id: 'later', order_index: 3001 }],
      sessions({ id: 'later', date_time: '2026-08-29T01:30:00.000Z', status: 'COMPLETED' }),
      now,
    )).toBe(true);
  });

  it('allows a future lesson to adopt the latest template', () => {
    expect(hasClassReachedTemplate(
      3,
      [
        { session_id: 'past', order_index: 2001 },
        { session_id: 'future', order_index: 3001 },
      ],
      sessions(
        { id: 'past', date_time: '2026-08-29T01:30:00.000Z', status: 'COMPLETED' },
        { id: 'future', date_time: '2026-09-05T01:30:00.000Z', status: 'SCHEDULED' },
      ),
      now,
    )).toBe(false);
  });
});
