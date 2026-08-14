import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  filterActionableTrialClassRows,
  type TrialClassSubmission,
} from '@/lib/dao/trialClassDao';
import {
  deleteTrialForAdmin,
  TrialDeletionError,
  type AdminTrialDeletionDependencies,
} from '@/lib/services/adminTrialDeletion';

const now = new Date('2026-08-14T10:00:00.000Z');

function trialRow(
  id: string,
  scheduledAt: string,
  assessmentStatus?: string,
) {
  return {
    id,
    status: 'SCHEDULED',
    scheduled_at: scheduledAt,
    trial_assessments: assessmentStatus ? { status: assessmentStatus } : null,
  } as unknown as TrialClassSubmission & {
    trial_assessments: { status: string } | null;
  };
}

describe('trial dashboard behavioral boundaries', () => {
  it('includes exactly-now and future trials, excludes past trials, and preserves draft access', () => {
    const cancelled = { ...trialRow('cancelled', '2026-08-14T10:15:00.000Z'), status: 'CANCELLED' as const };
    const rows = [
      trialRow('before', '2026-08-14T09:59:59.999Z'),
      trialRow('at-boundary', '2026-08-14T10:00:00.000Z', 'DRAFT'),
      trialRow('after', '2026-08-14T10:00:00.001Z'),
      trialRow('submitted', '2026-08-14T10:30:00.000Z', 'PENDING_ADMIN_REVIEW'),
      cancelled,
    ];

    const result = filterActionableTrialClassRows(rows, now);

    expect(result.map((trial) => trial.id)).toEqual(['at-boundary', 'after']);
  });

  it('does not treat a null or invalid schedule as actionable', () => {
    const rows = [
      trialRow('invalid', 'not-a-date'),
      { ...trialRow('null', '2026-08-14T10:00:00.000Z'), scheduled_at: null },
    ];

    expect(filterActionableTrialClassRows(rows, now)).toEqual([]);
  });
});

describe('admin trial deletion behavior', () => {
  function dependencies(overrides: Partial<AdminTrialDeletionDependencies> = {}) {
    const events: string[] = [];
    const deletedTrial = { id: 'trial-1', google_calendar_event_id: 'event-1' } as TrialClassSubmission;
    const base: AdminTrialDeletionDependencies = {
      getTrial: vi.fn(async () => ({ id: 'trial-1', google_calendar_event_id: 'event-1' })),
      getAssessment: vi.fn(async () => null),
      deleteCalendarEvent: vi.fn(async (eventId: string) => { events.push(`calendar:${eventId}`); }),
      deleteTrial: vi.fn(async (id: string) => { events.push(`database:${id}`); return deletedTrial; }),
    };

    return { dependencies: { ...base, ...overrides }, events, deletedTrial };
  }

  it('deletes Calendar before the database row when no assessment exists', async () => {
    const setup = dependencies();

    const result = await deleteTrialForAdmin('trial-1', setup.dependencies);

    expect(result).toBe(setup.deletedTrial);
    expect(setup.events).toEqual(['calendar:event-1', 'database:trial-1']);
  });

  it.each(['DRAFT', 'PENDING_ADMIN_REVIEW', 'CONVERTED'])(
    'protects a trial with a %s assessment from deletion',
    async (status) => {
      const setup = dependencies({ getAssessment: vi.fn(async () => ({ status })) });

      await expect(deleteTrialForAdmin('trial-1', setup.dependencies)).rejects.toMatchObject({
        name: 'TrialDeletionError',
        status: 409,
      });
      expect(setup.events).toEqual([]);
    },
  );

  it('does not delete the database row when Calendar cleanup fails', async () => {
    const setup = dependencies({
      deleteCalendarEvent: vi.fn(async () => { throw new Error('calendar unavailable'); }),
    });

    await expect(deleteTrialForAdmin('trial-1', setup.dependencies)).rejects.toMatchObject({
      name: 'TrialDeletionError',
      status: 502,
    });
    expect(setup.dependencies.deleteTrial).not.toHaveBeenCalled();
  });

  it('returns a not-found error without calling external services', async () => {
    const setup = dependencies({ getTrial: vi.fn(async () => null) });

    await expect(deleteTrialForAdmin('missing', setup.dependencies)).rejects.toBeInstanceOf(TrialDeletionError);
    expect(setup.dependencies.getAssessment).not.toHaveBeenCalled();
    expect(setup.dependencies.deleteCalendarEvent).not.toHaveBeenCalled();
    expect(setup.dependencies.deleteTrial).not.toHaveBeenCalled();
  });
});
