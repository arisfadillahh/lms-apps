import { describe, expect, it } from 'vitest';

import { canExtendBeforeNextLessonSession } from '@/lib/services/lessonExtensionBoundary';

const now = new Date('2026-08-22T10:00:00.000Z');

describe('lesson extension boundary', () => {
  it('allows extending a completed source while the next lesson is still future and untouched', () => {
    expect(canExtendBeforeNextLessonSession({
      dateTime: '2026-08-29T10:00:00.000Z',
      status: 'SCHEDULED',
      hasAttendance: false,
    }, now)).toBe(true);
  });

  it('blocks exactly when the next lesson starts, and after it starts', () => {
    const boundary = '2026-08-22T10:00:00.000Z';
    expect(canExtendBeforeNextLessonSession({ dateTime: boundary, status: 'SCHEDULED', hasAttendance: false }, now)).toBe(false);
    expect(canExtendBeforeNextLessonSession({ dateTime: '2026-08-22T10:00:01.000Z', status: 'SCHEDULED', hasAttendance: false }, now)).toBe(true);
    expect(canExtendBeforeNextLessonSession({ dateTime: '2026-08-21T10:00:00.000Z', status: 'SCHEDULED', hasAttendance: false }, now)).toBe(false);
  });

  it('blocks a future next lesson as soon as any attendance is recorded', () => {
    expect(canExtendBeforeNextLessonSession({
      dateTime: '2026-08-29T10:00:00.000Z',
      status: 'SCHEDULED',
      hasAttendance: true,
    }, now)).toBe(false);
  });

  it('blocks a completed next lesson and ignores cancelled sessions', () => {
    expect(canExtendBeforeNextLessonSession({
      dateTime: '2026-08-29T10:00:00.000Z',
      status: 'COMPLETED',
      hasAttendance: false,
    }, now)).toBe(false);
    expect(canExtendBeforeNextLessonSession({
      dateTime: '2026-08-21T10:00:00.000Z',
      status: 'CANCELLED',
      hasAttendance: true,
    }, now)).toBe(true);
  });
});
