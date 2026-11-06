import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ReimbursementEntry from './ReimbursementEntry';
import { tokenFromFragment } from './reimbursementToken';

describe('browser-only reimbursement token', () => {
  it('reads the token from the fragment and decodes URL encoding', () => {
    expect(tokenFromFragment('#token=personal.signed.token')).toBe('personal.signed.token');
    expect(tokenFromFragment('#token=encoded%2Btoken%3D')).toBe('encoded+token=');
  });
  it('never interprets a query string, raw URL, absent, or ambiguous token as a fragment token', () => {
    for (const value of ['', '#', '#other=value', '?token=private', 'https://example.invalid/payroll/reimbursement?token=private', '#token=one&token=two']) {
      expect(tokenFromFragment(value)).toBe('');
    }
  });
  it('server rendering keeps personal tokens out of HTML and shows a loading state', () => {
    vi.stubGlobal('window', { location: { href: 'http://localhost/payroll/reimbursement#token=private-fragment-token', hash: '#token=private-fragment-token' } });
    try {
      const html = renderToString(createElement(ReimbursementEntry));
      expect(html).toContain('Memuat formulir');
      expect(html).not.toContain('private-fragment-token');
      expect(html).not.toContain('x-payroll-reimbursement-token');
    } finally { vi.unstubAllGlobals(); }
  });
});
