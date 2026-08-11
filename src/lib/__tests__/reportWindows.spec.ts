import { describe, expect, it } from 'vitest';

import { isRegularReportWindowActive } from '@/lib/services/reportWindows';

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
