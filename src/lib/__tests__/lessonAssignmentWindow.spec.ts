import { describe, expect, it } from 'vitest';

import {
  resolveForwardAssignmentBlocks,
  resolveForwardAssignmentWindow,
} from '@/lib/services/lessonAssignmentWindow';

const sessions = [
  { id: 'session-1', date_time: '2026-06-05T09:15:00.000Z' },
  { id: 'session-2', date_time: '2026-06-12T09:15:00.000Z' },
  { id: 'session-3', date_time: '2026-06-19T09:15:00.000Z' },
  { id: 'session-4', date_time: '2026-06-26T09:15:00.000Z' },
];

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
