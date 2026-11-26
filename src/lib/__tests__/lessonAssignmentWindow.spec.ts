import { describe, expect, it } from 'vitest';

import {
  mapSlotsBetweenAssignedSessions,
  resolveForwardAssignmentBlocks,
  resolveForwardAssignmentWindow,
} from '@/lib/services/lessonAssignmentWindow';

const sessions = [
  { id: 'session-1', date_time: '2026-06-05T09:15:00.000Z' },
  { id: 'session-2', date_time: '2026-06-12T09:15:00.000Z' },
  { id: 'session-3', date_time: '2026-06-19T09:15:00.000Z' },
  { id: 'session-4', date_time: '2026-06-26T09:15:00.000Z' },
];

describe('lesson schedule display', () => {
  it('does not put a future lesson into an old unmapped session', () => {
    const first = { globalIndex: 0, explicitSessionId: 'session-1' };
    const lastCompleted = { globalIndex: 1, explicitSessionId: 'session-3' };
    const next = { globalIndex: 2, explicitSessionId: null };
    const schedule = mapSlotsBetweenAssignedSessions(sessions, [first, lastCompleted, next]);

    expect(schedule.get('session-1')).toBe(first);
    expect(schedule.has('session-2')).toBe(false);
    expect(schedule.get('session-3')).toBe(lastCompleted);
    expect(schedule.get('session-4')).toBe(next);
  });

  it('fills a matching gap without recycling a slot that already has a session', () => {
    const first = { globalIndex: 0, explicitSessionId: 'session-1' };
    const middle = { globalIndex: 1, explicitSessionId: null };
    const last = { globalIndex: 2, explicitSessionId: 'session-3' };
    const schedule = mapSlotsBetweenAssignedSessions(sessions, [first, middle, last]);

    expect(schedule.get('session-2')).toBe(middle);
    expect(schedule.has('session-4')).toBe(false);
  });
});

describe('resolveForwardAssignmentWindow', () => {
  it('ignores old lesson and session holes before the latest completed assignment', () => {
    const result = resolveForwardAssignmentWindow([
      { id: 'old-hole', session_id: null },
      { id: 'completed-1', session_id: 'session-1' },
      { id: 'completed-2', session_id: 'session-3' },
      { id: 'next-lesson', session_id: null },
      { id: 'later-lesson', session_id: null },
    ], sessions);

    expect(result.frontierLessonId).toBe('completed-2');
    expect(result.frontierSessionId).toBe('session-3');
    expect(result.lessonQueue.map((lesson) => lesson.id)).toEqual(['next-lesson', 'later-lesson']);
    expect(result.unassignedSessions.map((session) => session.id)).toEqual(['session-4']);
  });

  it('starts from the beginning when a class has no lesson assignments yet', () => {
    const result = resolveForwardAssignmentWindow([
      { id: 'lesson-1', session_id: null },
      { id: 'lesson-2', session_id: null },
    ], sessions.slice(0, 2));

    expect(result.frontierLessonId).toBeNull();
    expect(result.lessonQueue.map((lesson) => lesson.id)).toEqual(['lesson-1', 'lesson-2']);
    expect(result.unassignedSessions.map((session) => session.id)).toEqual(['session-1', 'session-2']);
  });

  it('preserves a manual forward shift and continues after its assigned lesson', () => {
    const result = resolveForwardAssignmentWindow([
      { id: 'lesson-1', session_id: 'session-1' },
      { id: 'manually-skipped', session_id: null },
      { id: 'manual-current', session_id: 'session-2' },
      { id: 'manual-next', session_id: null },
    ], sessions);

    expect(result.lessonQueue.map((lesson) => lesson.id)).toEqual(['manual-next']);
    expect(result.unassignedSessions.map((session) => session.id)).toEqual(['session-3', 'session-4']);
  });

  it('limits template synchronization to the frontier block and newer blocks', () => {
    const blocks = [{ id: 'historical' }, { id: 'current' }, { id: 'next' }];
    const lessonsByBlock = new Map([
      ['historical', [{ id: 'old-lesson' }]],
      ['current', [{ id: 'frontier-lesson' }]],
      ['next', [{ id: 'future-lesson' }]],
    ]);

    expect(
      resolveForwardAssignmentBlocks(blocks, lessonsByBlock, 'frontier-lesson').map(
        (block) => block.id,
      ),
    ).toEqual(['current', 'next']);
  });
});
