import { describe, expect, it } from 'vitest';

import { REPORT_DESCRIPTION_MAX_LENGTH, shortenReportDescription } from '@/lib/reportDescription';

describe('report coach description length', () => {
  it('preserves concise descriptions and trims outer whitespace', () => {
    expect(shortenReportDescription('  Perkembangannya baik.  ')).toBe('Perkembangannya baik.');
  });

  it('ends at a complete sentence when one fits near the limit', () => {
    const first = 'Ananda berkembang baik dalam memahami konsep dan menerapkannya pada latihan dengan mandiri. ';
    const result = shortenReportDescription(`${first.repeat(3)}Kalimat selanjutnya tidak perlu ditampilkan.`);

    expect(result.length).toBeLessThanOrEqual(REPORT_DESCRIPTION_MAX_LENGTH);
    expect(result.endsWith('.')).toBe(true);
  });

  it('shortens longer text at a word boundary and marks the omission', () => {
    const result = shortenReportDescription('kemampuan '.repeat(50));

    expect(result.length).toBeLessThanOrEqual(REPORT_DESCRIPTION_MAX_LENGTH);
    expect(result.endsWith('…')).toBe(true);
    expect(result.slice(0, -1).endsWith('kemampuan')).toBe(true);
  });
});
