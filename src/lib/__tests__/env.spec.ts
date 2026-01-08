import { describe, expect, it } from 'vitest';

import { getAppBaseUrl } from '@/lib/env';

describe('getAppBaseUrl', () => {
  it('returns NEXT_PUBLIC_APP_URL without trailing slash when provided', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com/';
    process.env.PDF_BASE_URL = undefined;
    process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;

    expect(getAppBaseUrl()).toBe('https://example.com');
  });

  it('falls back to PDF_BASE_URL then SUPABASE', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.PDF_BASE_URL = 'https://pdf.example.com/';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.example.com/';

    expect(getAppBaseUrl()).toBe('https://pdf.example.com');
  });
});
