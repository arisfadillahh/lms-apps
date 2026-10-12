import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, shouldUpgradeInsecureRequests } from '../security/contentSecurityPolicy';

describe('content security policy for local HTTP', () => {
  it('keeps HTTPS upgrade by default', () => {
    expect(buildContentSecurityPolicy()).toContain('upgrade-insecure-requests');
  });

  it('omits HTTPS upgrade for an explicit HTTP app URL', () => {
    expect(shouldUpgradeInsecureRequests('http://127.0.0.1:3005')).toBe(false);
    expect(buildContentSecurityPolicy({ upgradeInsecureRequests: false }))
      .not.toContain('upgrade-insecure-requests');
  });

  it('keeps HTTPS headers for HTTPS and unset app URLs', () => {
    expect(shouldUpgradeInsecureRequests('https://lms.example')).toBe(true);
    expect(shouldUpgradeInsecureRequests(undefined)).toBe(true);
  });
});
