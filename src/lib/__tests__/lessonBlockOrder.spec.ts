import { describe, expect, it } from 'vitest';

import { compareClassBlocksInLessonOrder } from '@/lib/services/lessonBlockOrder';
import { resolveForwardAssignmentWindow } from '@/lib/services/lessonAssignmentWindow';

describe('overlapping class blocks', () => {
  it('fills future sessions through Advance Apps before Game Design, retaining the past frontier', () => {
    const apps = { id: 'apps', created_at: '2026-10-01T00:00:00Z', start_date: '2026-10-31', block_order_index: 3 };
    const game = { id: 'game', created_at: '2026-10-02T00:00:00Z', start_date: '2026-11-28', block_order_index: 4 };
    const next = { id: 'next', created_at: '2026-10-03T00:00:00Z', start_date: '2027-01-02', block_order_index: 5 };
    const blocks = [next, game, apps].sort(compareClassBlocksInLessonOrder);
    expect(blocks.map((block) => block.id)).toEqual(['apps', 'game', 'next']);

    const lessons = [
      { id: 'apps-3002', session_id: 'past' },
      { id: 'apps-4001', session_id: null },
      { id: 'apps-5001', session_id: null },
      { id: 'apps-6001', session_id: null },
      { id: 'game-3002', session_id: null },
      { id: 'game-4001', session_id: null },
      { id: 'next-1001', session_id: null },
    ];
    const sessions = [
      { id: 'past', date_time: '2026-11-21T03:30:00Z' },
      ...['2026-11-28', '2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26', '2027-01-02']
        .map((date, index) => ({ id: `future-${index}`, date_time: `${date}T03:30:00Z` })),
    ];
    const window = resolveForwardAssignmentWindow(lessons, sessions);
    expect(window.frontierSessionId).toBe('past');
    expect(window.lessonQueue.map((lesson) => lesson.id)).toEqual([
      'apps-4001', 'apps-5001', 'apps-6001', 'game-3002', 'game-4001', 'next-1001',
    ]);
    expect(window.unassignedSessions.map((session) => session.id)).toEqual(
      sessions.slice(1).map((session) => session.id),
    );
  });

  it('uses template order when blocks were created in one transaction and dates overlap', () => {
    const common = { created_at: '2026-11-14T03:55:17Z', start_date: '2026-11-28' };
    const blocks = [
      { ...common, id: 'game', block_order_index: 4 },
      { ...common, id: 'apps', block_order_index: 3 },
    ].sort(compareClassBlocksInLessonOrder);
    expect(blocks.map((block) => block.id)).toEqual(['apps', 'game']);
  });
});
