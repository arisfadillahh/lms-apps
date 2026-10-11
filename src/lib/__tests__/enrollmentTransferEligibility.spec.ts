import { describe, expect, it } from 'vitest';

import type { EnrollmentRecord } from '@/lib/dao/classesDao';
import {
  isClassActiveForOperationalMessages,
  isEnrollmentActiveForSession,
  isEnrollmentCurrentForUpcomingSession,
} from '@/lib/services/enrollmentEligibility';

function enrollment(overrides: Partial<EnrollmentRecord> = {}): EnrollmentRecord {
  return {
    id: 'enrollment-id',
    class_id: 'class-id',
    coder_id: 'coder-id',
    enrolled_at: '2026-09-01T00:00:00.000Z',
    ended_at: null,
    exit_reason: null,
    status: 'ACTIVE',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('transfer-aware enrollment eligibility', () => {
  it('keeps sessions before the transfer as valid history', () => {
    const moved = enrollment({
      status: 'INACTIVE',
      ended_at: '2026-09-08T00:00:00.000Z',
      exit_reason: 'TRANSFERRED',
    });

    expect(isEnrollmentActiveForSession(moved, '2026-09-07T10:00:00.000Z')).toBe(true);
    expect(isEnrollmentActiveForSession(moved, '2026-09-09T10:00:00.000Z')).toBe(false);
  });

  it('blocks reminders from an old class after transfer', () => {
    const moved = enrollment({
      status: 'INACTIVE',
      ended_at: '2026-09-08T00:00:00.000Z',
      exit_reason: 'TRANSFERRED',
    });
    expect(isEnrollmentCurrentForUpcomingSession(moved, '2026-09-09T10:00:00.000Z')).toBe(false);
  });

  it('blocks reminders for paused, ended, and cancelled classes', () => {
    expect(isClassActiveForOperationalMessages('ACTIVE')).toBe(true);
    expect(isClassActiveForOperationalMessages('PAUSED')).toBe(false);
    expect(isClassActiveForOperationalMessages('ENDED')).toBe(false);
    expect(isClassActiveForOperationalMessages('CANCELLED')).toBe(false);
  });
});
