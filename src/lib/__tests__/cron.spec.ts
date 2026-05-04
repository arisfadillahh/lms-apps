import { afterEach, describe, expect, it, vi } from 'vitest';

import { verifyCronRequest } from '@/lib/cron';

describe('verifyCronRequest', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects cron requests when CRON_SECRET is missing', () => {
    vi.stubEnv('CRON_SECRET', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const request = new Request('https://example.test/api/cron/generate-reports');

    expect(verifyCronRequest(request)).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('accepts a matching bearer token', () => {
    vi.stubEnv('CRON_SECRET', 'secret-value');

    const request = new Request('https://example.test/api/cron/generate-reports', {
      headers: { authorization: 'Bearer secret-value' },
    });

    expect(verifyCronRequest(request)).toBe(true);
  });

  it('rejects requests without an authorization header', () => {
    vi.stubEnv('CRON_SECRET', 'secret-value');

    const request = new Request('https://example.test/api/cron/generate-reports');

    expect(verifyCronRequest(request)).toBe(false);
  });

  it('rejects a wrong bearer token', () => {
    vi.stubEnv('CRON_SECRET', 'secret-value');

    const request = new Request('https://example.test/api/cron/generate-reports', {
      headers: { authorization: 'Bearer wrong-value' },
    });

    expect(verifyCronRequest(request)).toBe(false);
  });
});
