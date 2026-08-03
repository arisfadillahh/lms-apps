import { describe, expect, it } from 'vitest';

import { shouldPreserveArchivedClassLesson } from '@/lib/services/lessonArchivePolicy';

const now = new Date('2026-08-01T12:00:00.000Z');

describe('lesson archive policy', () => {
  it('preserves completed sessions and completed blocks', () => {
    expect(shouldPreserveArchivedClassLesson({
      blockStatus: 'CURRENT',
      hasMakeUpTask: false,
      sessionDateTime: '2026-07-14T09:00:00.000Z',
      sessionStatus: 'COMPLETED',
    }, now)).toBe(true);

    expect(shouldPreserveArchivedClassLesson({
      blockStatus: 'COMPLETED',
      hasMakeUpTask: false,
      sessionDateTime: null,
      sessionStatus: null,
    }, now)).toBe(true);
  });

  it('preserves lessons referenced by make-up tasks', () => {
    expect(shouldPreserveArchivedClassLesson({
      blockStatus: 'CURRENT',
      hasMakeUpTask: true,
      sessionDateTime: '2026-08-06T11:30:00.000Z',
      sessionStatus: 'SCHEDULED',
    }, now)).toBe(true);
  });

  it('removes only unassigned or future scheduled lessons', () => {
    expect(shouldPreserveArchivedClassLesson({
      blockStatus: 'UPCOMING',
      hasMakeUpTask: false,
      sessionDateTime: null,
      sessionStatus: null,
    }, now)).toBe(false);

    expect(shouldPreserveArchivedClassLesson({
      blockStatus: 'CURRENT',
      hasMakeUpTask: false,
      sessionDateTime: '2026-08-06T11:30:00.000Z',
      sessionStatus: 'SCHEDULED',
    }, now)).toBe(false);
  });

  it('preserves a past session even if its completion status was not updated', () => {
    expect(shouldPreserveArchivedClassLesson({
      blockStatus: 'CURRENT',
      hasMakeUpTask: false,
      sessionDateTime: '2026-07-20T09:00:00.000Z',
      sessionStatus: 'SCHEDULED',
    }, now)).toBe(true);
  });
});
