import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLocalhostFallback, normalizeLocalhostUrl } from '@/lib/runtimeUrl';

describe('normalizeLocalhostUrl', () => {
  afterEach(() => {
    delete process.env.PORT;
  });

  it('keeps non-localhost URLs unchanged', () => {
    process.env.PORT = '3005';

    expect(normalizeLocalhostUrl('https://lms.clevio.co/app')).toBe('https://lms.clevio.co/app');
  });

  it('keeps localhost unchanged when PORT is not set', () => {
    delete process.env.PORT;

    expect(normalizeLocalhostUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('rewrites localhost to the runtime port', () => {
    process.env.PORT = '3005';

    expect(normalizeLocalhostUrl('http://localhost:3000/invoice')).toBe('http://localhost:3005/invoice');
  });

  it('keeps invalid URLs unchanged', () => {
    process.env.PORT = '3005';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(normalizeLocalhostUrl('not a url')).toBe('not a url');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('getLocalhostFallback', () => {
  afterEach(() => {
    delete process.env.PORT;
  });

  it('uses port 3000 by default', () => {
    delete process.env.PORT;

    expect(getLocalhostFallback()).toBe('http://localhost:3000');
  });

  it('uses the runtime PORT when present', () => {
    process.env.PORT = '3005';

    expect(getLocalhostFallback()).toBe('http://localhost:3005');
  });
});
