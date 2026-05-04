import { describe, expect, it } from 'vitest';

import { resolvePitchingDayDate } from '@/lib/services/pitchingDay';

describe('resolvePitchingDayDate', () => {
  it('uses the second-to-last session for a 19-session block', () => {
    const dates = Array.from({ length: 19 }, (_, index) => `2026-01-${String(index + 1).padStart(2, '0')}T10:00:00+07:00`);

    expect(resolvePitchingDayDate(dates, null)).toBe('2026-01-18');
  });

  it('uses the second-to-last session for a 17-session block', () => {
    const dates = Array.from({ length: 17 }, (_, index) => `2026-02-${String(index + 1).padStart(2, '0')}T10:00:00+07:00`);

    expect(resolvePitchingDayDate(dates, null)).toBe('2026-02-16');
  });

  it('deduplicates multiple lessons mapped to the same session', () => {
    const dates = [
      '2026-03-01T10:00:00+07:00',
      '2026-03-01T10:00:00+07:00',
      '2026-03-08T10:00:00+07:00',
      '2026-03-15T10:00:00+07:00',
    ];

    expect(resolvePitchingDayDate(dates, null)).toBe('2026-03-08');
  });

  it('sorts sessions before choosing the second-to-last date', () => {
    const dates = [
      '2026-04-22T10:00:00+07:00',
      '2026-04-01T10:00:00+07:00',
      '2026-04-15T10:00:00+07:00',
      '2026-04-08T10:00:00+07:00',
    ];

    expect(resolvePitchingDayDate(dates, null)).toBe('2026-04-15');
  });

  it('falls back to the stored date when no session dates exist', () => {
    expect(resolvePitchingDayDate([], '2026-05-10')).toBe('2026-05-10');
  });
});
