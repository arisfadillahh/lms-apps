import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';

import { createInvoicePublicToken, verifyInvoicePublicToken } from '@/lib/services/invoicePublicAccess';

const invoice = {
  invoice_number: 'CCR072-062026',
  parent_phone: '+62 812-3456-7890',
  total_amount: 1250000,
};

function createLegacyAmountToken(amount: number): string {
  return createHmac('sha256', process.env.INVOICE_PUBLIC_TOKEN_SECRET!)
    .update([invoice.invoice_number, '6281234567890', amount.toString()].join('|'))
    .digest('base64url');
}

describe('invoice public access tokens', () => {
  beforeEach(() => {
    process.env.INVOICE_PUBLIC_TOKEN_SECRET = 'test-invoice-public-token-secret';
  });

  it('keeps generated public invoice links valid when invoice amount changes', () => {
    const token = createInvoicePublicToken(invoice);

    expect(verifyInvoicePublicToken({ ...invoice, total_amount: 1500000 }, token)).toBe(true);
  });

  it('still accepts legacy amount-based tokens for existing links', () => {
    const token = createLegacyAmountToken(invoice.total_amount);

    expect(verifyInvoicePublicToken(invoice, token)).toBe(true);
  });
});
