import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from '@/lib/security/contentSecurityPolicy';

describe('Coach icon font security policy', () => {
  it('allows the exact Google Fonts origins used by Material Symbols', () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(policy).toContain("font-src 'self' data: https://fonts.gstatic.com");
  });

  it('does not broaden font loading to arbitrary origins', () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).not.toContain('font-src https:');
    expect(policy).not.toContain('style-src https:');
  });
});
