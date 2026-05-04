import { describe, expect, it } from 'vitest';

import {
  mergeCoachClassesById,
  pickNextCoachSession,
  pickRelevantCoachSessions,
} from '@/lib/services/coachClassSummary';

describe('mergeCoachClassesById', () => {
  it('keeps all own and substitute classes', () => {
    expect(mergeCoachClassesById([{ id: 'own' }], [{ id: 'sub' }])).toEqual([{ id: 'own' }, { id: 'sub' }]);
  });

  it('deduplicates duplicate class IDs', () => {
    expect(mergeCoachClassesById([{ id: 'same', source: 'own' }], [{ id: 'same', source: 'sub' }])).toEqual([
      { id: 'same', source: 'sub' },
    ]);
  });
});

describe('pickRelevantCoachSessions', () => {
  const sessions = [
    { id: 'main', substitute_coach_id: null },
    { id: 'sub-other', substitute_coach_id: 'coach-2' },
    { id: 'sub-mine', substitute_coach_id: 'coach-1' },
  ];

  it('keeps all sessions for the main coach', () => {
    expect(pickRelevantCoachSessions(sessions, true, 'coach-1')).toHaveLength(3);
  });

  it('keeps only substitute sessions for substitute coaches', () => {
    expect(pickRelevantCoachSessions(sessions, false, 'coach-1')).toEqual([{ id: 'sub-mine', substitute_coach_id: 'coach-1' }]);
  });
});

describe('pickNextCoachSession', () => {
  it('returns the nearest future session', () => {
    const now = new Date('2026-05-02T10:00:00.000Z');
    const sessions = [
      { id: 'later', date_time: '2026-05-03T10:00:00.000Z' },
      { id: 'past', date_time: '2026-05-01T10:00:00.000Z' },
      { id: 'next', date_time: '2026-05-02T11:00:00.000Z' },
    ];

    expect(pickNextCoachSession(sessions, now)?.id).toBe('next');
  });

  it('returns undefined when no future session exists', () => {
    expect(pickNextCoachSession([{ id: 'past', date_time: '2026-05-01T10:00:00.000Z' }], new Date('2026-05-02T10:00:00.000Z'))).toBeUndefined();
  });
});
