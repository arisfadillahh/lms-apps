import { describe, expect, it } from 'vitest';

import {
  filterActiveEnrollmentsForSession,
  filterEvaluationEnrollmentsForSession,
  isEnrollmentActiveForSession,
} from '@/lib/services/enrollmentEligibility';
import type { EnrollmentRecord } from '@/lib/dao/classesDao';

function enrollment(overrides: Partial<EnrollmentRecord>): EnrollmentRecord {
  return {
    id: 'enrollment-id',
    class_id: 'class-id',
    coder_id: 'coder-id',
    enrolled_at: '2026-04-01T00:00:00.000Z',
    status: 'ACTIVE',
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  } as EnrollmentRecord;
}

describe('enrollment eligibility for session-scoped evaluation', () => {
  it('excludes active students who joined after a completed session', () => {
    expect(isEnrollmentActiveForSession(
      enrollment({ enrolled_at: '2026-04-26T00:00:00.000Z' }),
      '2026-04-25T03:00:00.000Z',
    )).toBe(false);
  });

  it('keeps active students who were enrolled before the session', () => {
    expect(isEnrollmentActiveForSession(
      enrollment({ enrolled_at: '2026-04-24T00:00:00.000Z' }),
      '2026-04-25T03:00:00.000Z',
    )).toBe(true);
  });

  it('filters inactive and late-joining enrollments from the session roster', () => {
    const result = filterActiveEnrollmentsForSession([
      enrollment({ id: 'before', coder_id: 'before', enrolled_at: '2026-04-24T00:00:00.000Z' }),
      enrollment({ id: 'late', coder_id: 'late', enrolled_at: '2026-04-26T00:00:00.000Z' }),
      enrollment({ id: 'inactive', coder_id: 'inactive', status: 'INACTIVE' }),
    ], '2026-04-25T03:00:00.000Z');

    expect(result.map((item) => item.coder_id)).toEqual(['before']);
  });

  it('includes an active late-joining Coder when the session has PRESENT attendance', () => {
    const lateEnrollment = enrollment({
      coder_id: 'late-present',
      enrolled_at: '2026-04-26T00:00:00.000Z',
    });

    const result = filterEvaluationEnrollmentsForSession(
      [lateEnrollment],
      '2026-04-25T03:00:00.000Z',
      [{ coder_id: 'late-present', status: 'PRESENT' }],
    );

    expect(result.map((item) => item.coder_id)).toEqual(['late-present']);
  });

  it('does not reopen historical evaluations for ABSENT or inactive late joiners', () => {
    const result = filterEvaluationEnrollmentsForSession(
      [
        enrollment({ coder_id: 'late-absent', enrolled_at: '2026-04-26T00:00:00.000Z' }),
        enrollment({
          coder_id: 'late-inactive',
          enrolled_at: '2026-04-26T00:00:00.000Z',
          status: 'INACTIVE',
        }),
      ],
      '2026-04-25T03:00:00.000Z',
      [
        { coder_id: 'late-absent', status: 'ABSENT' },
        { coder_id: 'late-inactive', status: 'PRESENT' },
      ],
    );

    expect(result).toEqual([]);
  });
});
