import { describe, expect, it } from 'vitest';

import { applyTypoReplacements } from '@/lib/services/trialInsightTypos';

describe('trial insight typo replacements', () => {
  it('applies an exact typo replacement without changing surrounding text', () => {
    const result = applyTypoReplacements('Anak sangat aktf dan berani mencoba.', [
      { from: 'aktf', to: 'aktif' },
    ]);

    expect(result.text).toBe('Anak sangat aktif dan berani mencoba.');
    expect(result.applied).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it('allows a phrase context when only one word contains the typo', () => {
    const result = applyTypoReplacements('Anak sangat aktf dan berani mencoba.', [
      { from: 'sangat aktf dan', to: 'sangat aktif dan' },
    ]);

    expect(result.text).toBe('Anak sangat aktif dan berani mencoba.');
    expect(result.applied).toHaveLength(1);
  });

  it('rejects ambiguous replacements so repeated text is not rewritten broadly', () => {
    const result = applyTypoReplacements('Anak aktif. Coach melihat anak aktif.', [
      { from: 'aktif', to: 'antusias' },
    ]);

    expect(result.text).toBe('Anak aktif. Coach melihat anak aktif.');
    expect(result.applied).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });

  it('rejects a semantic rewrite even when the source appears once', () => {
    const result = applyTypoReplacements('Anak aktif mengikuti trial.', [
      { from: 'aktif', to: 'antusias' },
    ]);

    expect(result.text).toBe('Anak aktif mengikuti trial.');
    expect(result.applied).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });

  it('returns the original text when the AI suggests too many changes', () => {
    const result = applyTypoReplacements('Teks tetap.', Array.from({ length: 13 }, (_, index) => ({
      from: `salah-${index}`,
      to: `benar-${index}`,
    })));

    expect(result.text).toBe('Teks tetap.');
    expect(result.applied).toHaveLength(0);
    expect(result.rejected).toHaveLength(13);
  });
});
