import { describe, expect, it } from 'vitest';

import {
  listCurrentCycleBlocks,
  pickCurrentCycleProgressBlock,
  resolveCycleLessonProgress,
} from '@/lib/services/classCycleProgress';

describe('listCurrentCycleBlocks', () => {
  it('ignores completed historical blocks from previous cycles', () => {
    const blocks = [
      { id: 'history-block-4', status: 'COMPLETED', start_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z' },
      { id: 'cycle-block-3', status: 'CURRENT', start_date: '2026-05-01', created_at: '2026-05-01T00:00:00Z' },
      { id: 'cycle-block-4', status: 'UPCOMING', start_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z' },
    ];

    expect(listCurrentCycleBlocks(blocks).map((block) => block.id)).toEqual(['cycle-block-3', 'cycle-block-4']);
  });

  it('falls back to the latest block when a class has no active cycle status', () => {
    const blocks = [
      { id: 'history-block-1', status: 'COMPLETED', start_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z' },
      { id: 'history-block-2', status: 'COMPLETED', start_date: '2026-02-01', created_at: '2026-02-01T00:00:00Z' },
    ];

    expect(listCurrentCycleBlocks(blocks).map((block) => block.id)).toEqual(['history-block-2']);
  });
});

describe('pickCurrentCycleProgressBlock', () => {
  it('uses the current block for class progress instead of a completed repeated block', () => {
    const blocks = [
      { id: 'old-block-4', status: 'COMPLETED', start_date: '2026-03-01', created_at: '2026-03-01T00:00:00Z' },
      { id: 'new-block-4', status: 'CURRENT', start_date: '2026-05-01', created_at: '2026-05-01T00:00:00Z' },
    ];

    expect(pickCurrentCycleProgressBlock(blocks)?.id).toBe('new-block-4');
  });

  it('uses the first upcoming block when the current block has not started yet', () => {
    const blocks = [
      { id: 'next-block-1', status: 'UPCOMING', start_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z' },
      { id: 'next-block-2', status: 'UPCOMING', start_date: '2026-07-01', created_at: '2026-07-01T00:00:00Z' },
    ];

    expect(pickCurrentCycleProgressBlock(blocks)?.id).toBe('next-block-1');
  });
});

describe('resolveCycleLessonProgress', () => {
  it('returns 0 percent for a fresh repeated block with no completed current-cycle lessons', () => {
    const lessons = [
      { order_index: 1, session_id: null },
      { order_index: 2, session_id: null },
      { order_index: 3, session_id: null },
    ];

    expect(resolveCycleLessonProgress(lessons, [])).toEqual({
      completedLessons: 0,
      totalLessons: 3,
      percent: 0,
    });
  });

  it('counts completed lessons in the selected cycle block only', () => {
    const lessons = [
      { order_index: 1, session_id: 'session-1' },
      { order_index: 2, session_id: 'session-2' },
      { order_index: 3, session_id: 'session-3' },
    ];
    const sessions = [
      { id: 'session-1', status: 'COMPLETED' },
      { id: 'session-2', status: 'SCHEDULED' },
      { id: 'session-3', status: 'SCHEDULED' },
    ];

    expect(resolveCycleLessonProgress(lessons, sessions)).toEqual({
      completedLessons: 1,
      totalLessons: 3,
      percent: 33,
    });
  });
});
