import { describe, expect, it } from 'vitest';
import { resolveScheduledContinuations } from '@/lib/services/coderJourneyPolicy';
import type { PersonalBlock } from '@/lib/services/personalBlockQueue';

const finished = {
  block_id: 'code-design', status: 'COMPLETED', runtimeStatus: 'COMPLETED' as const,
  firstSessionAt: '2026-04-25T02:00:00Z', lastSessionAt: '2026-10-10T02:00:00Z',
};
const running = {
  block_id: 'interactive', status: 'CURRENT', runtimeStatus: 'CURRENT' as const,
  firstSessionAt: '2026-10-17T02:00:00Z', lastSessionAt: '2027-02-13T02:00:00Z',
};
const journey: PersonalBlock[] = [
  { block_id: 'code-design', status: 'IN_PROGRESS', journey_order: 1 },
  { block_id: 'interactive', status: 'PENDING', journey_order: 2 },
  { block_id: 'create', status: 'PENDING', journey_order: 3 },
];

describe('Coder scheduled class continuation', () => {
  it('shows the running block when the scheduled previous block finished and personal assessment is pending', () => {
    expect(resolveScheduledContinuations([running, finished], journey)).toEqual([running]);
    expect(journey.map((row) => row.status)).toEqual(['IN_PROGRESS', 'PENDING', 'PENDING']);
  });

  it('keeps the previous block if it lacks completion evidence or a repeat is still open', () => {
    expect(resolveScheduledContinuations([{ ...finished, lastSessionAt: null }, running], journey)).toEqual([]);
    expect(resolveScheduledContinuations([{ ...finished, runtimeStatus: 'CURRENT' }, running], journey)).toEqual([]);
    expect(resolveScheduledContinuations([finished, { ...finished, status: 'UPCOMING' }, running], journey)).toEqual([]);
  });

  it('retains completed materials as the class starts the next scheduled block', () => {
    const taught = { ...running, status: 'COMPLETED', runtimeStatus: 'COMPLETED' as const };
    const successor = {
      ...running, block_id: 'create', firstSessionAt: '2027-02-20T02:00:00Z', lastSessionAt: '2027-05-30T02:00:00Z',
    };
    expect(resolveScheduledContinuations([finished, taught, successor], journey)).toEqual([taught, successor]);
  });

  it('respects deferred placement, personal queue order, and the actual start of the next block', () => {
    const [old, next, later] = journey;
    expect(resolveScheduledContinuations([finished, running], [old, { ...next, deferred_after_class: true }, later])).toEqual([]);
    expect(resolveScheduledContinuations([finished, running], [old, { ...next, journey_order: 4 }, later])).toEqual([]);
    expect(resolveScheduledContinuations([finished, { ...running, runtimeStatus: 'UPCOMING' }], journey)).toEqual([]);
    expect(resolveScheduledContinuations([finished, { ...running, firstSessionAt: finished.lastSessionAt }], journey)).toEqual([]);
  });
});
