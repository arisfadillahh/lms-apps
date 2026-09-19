import { describe, expect, it } from 'vitest';

import { isCoachEvaluationBlockActive, isRegularReportWindowActive } from '@/lib/services/reportWindows';

describe('regular report window', () => {
  it('is active on pitching day', () => {
    expect(
      isRegularReportWindowActive(
        { pitching_day_date: '2026-05-10' },
        new Date('2026-05-10T08:00:00+07:00'),
      ),
    ).toBe(true);
  });

  it('is inactive before pitching day', () => {
    expect(
      isRegularReportWindowActive(
        { pitching_day_date: '2026-05-10' },
        new Date('2026-05-09T23:59:00+07:00'),
      ),
    ).toBe(false);
  });

  it('is inactive for stale old pitching days', () => {
    expect(
      isRegularReportWindowActive(
        { pitching_day_date: '2026-05-10' },
        new Date('2026-08-10T10:46:00+07:00'),
      ),
    ).toBe(false);
  });

  it('is inactive without a configured pitching day', () => {
    expect(isRegularReportWindowActive({ pitching_day_date: null })).toBe(false);
  });
});

describe('Coach lesson evaluation block visibility', () => {
  const now = new Date('2026-09-19T08:00:00+07:00');

  it('keeps a completed block evaluable while its report window is active', () => {
    expect(
      isCoachEvaluationBlockActive(
        { status: 'COMPLETED', pitching_day_date: '2026-09-05' },
        now,
      ),
    ).toBe(true);
  });

  it('keeps the current block evaluable before pitching day', () => {
    expect(
      isCoachEvaluationBlockActive(
        { status: 'CURRENT', pitching_day_date: '2026-12-05' },
        now,
      ),
    ).toBe(true);
  });

  it('does not revive stale completed blocks', () => {
    expect(
      isCoachEvaluationBlockActive(
        { status: 'COMPLETED', pitching_day_date: '2026-05-02' },
        now,
      ),
    ).toBe(false);
  });
});
