import { describe, expect, it } from 'vitest';

import { hasSessionStarted } from '@/lib/sessionTiming';

describe('hasSessionStarted', () => {
  const now = new Date('2026-09-12T10:00:00.000Z');

  it('rejects a session whose start time is still in the future', () => {
    expect(hasSessionStarted('2026-09-12T10:00:01.000Z', now)).toBe(false);
  });

  it('allows attendance exactly at the session start time', () => {
    expect(hasSessionStarted('2026-09-12T10:00:00.000Z', now)).toBe(true);
  });

  it('allows a session that has already started', () => {
    expect(hasSessionStarted('2026-09-12T09:59:59.000Z', now)).toBe(true);
  });

  it('fails closed for an invalid session date', () => {
    expect(hasSessionStarted('invalid-date', now)).toBe(false);
  });
});
