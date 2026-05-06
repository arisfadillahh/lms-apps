import { describe, expect, it } from 'vitest';

import {
  resolveBlockRuntimeDates,
  resolveBlockStatus,
  resolveCurrentBlockIndex,
  resolveNextBlockTemplateIndex,
} from '@/lib/services/blockRuntime';

const block = {
  start_date: '2026-01-01',
  end_date: '2026-01-31',
  pitching_day_date: '2026-01-20',
};

describe('resolveCurrentBlockIndex', () => {
  it('uses the first block with a future lesson', () => {
    expect(resolveCurrentBlockIndex([
      { hasFutureLesson: false },
      { hasFutureLesson: true },
      { hasFutureLesson: true },
    ])).toBe(1);
  });

  it('falls back to the last block when no future lesson exists', () => {
    expect(resolveCurrentBlockIndex([
      { hasFutureLesson: false },
      { hasFutureLesson: false },
      { hasFutureLesson: false },
    ])).toBe(2);
  });
});

describe('resolveBlockStatus', () => {
  it('marks blocks before the current index as completed', () => {
    expect(resolveBlockStatus(0, 1)).toBe('COMPLETED');
  });

  it('marks the current index as current', () => {
    expect(resolveBlockStatus(1, 1)).toBe('CURRENT');
  });

  it('marks blocks after the current index as upcoming', () => {
    expect(resolveBlockStatus(2, 1)).toBe('UPCOMING');
  });
});

describe('resolveBlockRuntimeDates', () => {
  it('uses mapped lesson sessions for start, end, and pitching dates', () => {
    const sessions = [
      { id: 's1', date_time: '2026-02-01T10:00:00+07:00' },
      { id: 's2', date_time: '2026-02-08T10:00:00+07:00' },
      { id: 's3', date_time: '2026-02-15T10:00:00+07:00' },
    ];
    const lessons = [{ session_id: 's3' }, { session_id: 's1' }, { session_id: 's2' }];

    expect(resolveBlockRuntimeDates(block, lessons, sessions)).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-15',
      pitchingDayDate: '2026-02-08',
    });
  });

  it('falls back to existing block dates when no sessions are mapped', () => {
    expect(resolveBlockRuntimeDates(block, [{ session_id: null }], [])).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      pitchingDayDate: '2026-01-20',
    });
  });
});

describe('resolveNextBlockTemplateIndex', () => {
  const templates = Array.from({ length: 10 }, (_, index) => ({ id: `block-${index + 1}` }));

  it('uses the current cycle block instead of the last completed historical block', () => {
    const blocks = [
      { id: 'cycle-current', block_id: 'block-3', status: 'CURRENT' as const, start_date: '2026-05-01', created_at: '2026-05-01T00:00:00Z' },
      { id: 'history-4', block_id: 'block-4', status: 'COMPLETED' as const, start_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z' },
      { id: 'history-10', block_id: 'block-10', status: 'COMPLETED' as const, start_date: '2026-04-01', created_at: '2026-04-01T00:00:00Z' },
    ];

    expect(resolveNextBlockTemplateIndex(blocks, templates)).toBe(3);
  });

  it('wraps to the first block only when the active cycle is on the last block', () => {
    const blocks = [
      { id: 'cycle-last', block_id: 'block-10', status: 'CURRENT' as const, start_date: '2026-05-01', created_at: '2026-05-01T00:00:00Z' },
    ];

    expect(resolveNextBlockTemplateIndex(blocks, templates)).toBe(0);
  });

  it('continues after the latest upcoming block when future capacity already exists', () => {
    const blocks = [
      { id: 'cycle-current', block_id: 'block-3', status: 'CURRENT' as const, start_date: '2026-05-01', created_at: '2026-05-01T00:00:00Z' },
      { id: 'cycle-upcoming', block_id: 'block-4', status: 'UPCOMING' as const, start_date: '2026-06-01', created_at: '2026-06-01T00:00:00Z' },
    ];

    expect(resolveNextBlockTemplateIndex(blocks, templates)).toBe(4);
  });
});
