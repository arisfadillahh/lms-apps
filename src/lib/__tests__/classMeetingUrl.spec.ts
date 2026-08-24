import { describe, expect, it } from 'vitest';

import { normalizeClassMeetingUrl } from '@/lib/classMeetingUrl';

describe('normalizeClassMeetingUrl', () => {
  it('accepts real meeting URLs and adds a missing scheme', () => {
    expect(normalizeClassMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
    expect(normalizeClassMeetingUrl('zoom.us/j/123456')).toBe('https://zoom.us/j/123456');
  });

  it('repairs the legacy missing-slashes URL format', () => {
    expect(normalizeClassMeetingUrl('https:meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij');
  });

  it('rejects Clevio classroom placeholders and unsafe protocols', () => {
    expect(normalizeClassMeetingUrl('https:clev.io/Classroom')).toBeNull();
    expect(normalizeClassMeetingUrl('http://Clev.io/Classroom')).toBeNull();
    expect(normalizeClassMeetingUrl('javascript:alert(1)')).toBeNull();
  });
});
