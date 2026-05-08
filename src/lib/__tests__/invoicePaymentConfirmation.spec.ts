import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildPaymentConfirmationMessage,
  formatPaymentConfirmationPaidDate,
  resolvePaymentConfirmationTarget,
} from '@/lib/services/invoicePaymentConfirmation';

const invoice = {
  invoice_number: 'CCR001-052026',
  parent_name: 'Orang Tua Test',
  parent_phone: '628123456789',
  total_amount: 1250000,
};

const settings = {
  base_url: 'https://lms.clevio.co',
  payment_confirmation_template:
    'Yth. Bpk/Ibu {parent_name}, invoice {invoice_number} sebesar Rp {amount} sudah dibayar pada {paid_date}. Link: {invoice_url}',
};

describe('invoice payment confirmation helpers', () => {
  beforeAll(() => {
    process.env.INVOICE_PUBLIC_TOKEN_SECRET = 'test-invoice-public-token-secret';
  });

  it('keeps payment confirmation target on invoice parent_phone', () => {
    expect(resolvePaymentConfirmationTarget(invoice)).toBe('628123456789');
  });

  it('formats paid date in Indonesian locale', () => {
    expect(formatPaymentConfirmationPaidDate('2026-05-02T00:00:00.000Z')).toContain('2026');
  });

  it('builds the same payment confirmation template replacements as the route', () => {
    const message = buildPaymentConfirmationMessage(invoice, settings, '2026-05-02T00:00:00.000Z');

    expect(message).toContain('Orang Tua Test');
    expect(message).toContain('CCR001-052026');
    expect(message).toContain('1.250.000');
    expect(message).toContain('https://lms.clevio.co/invoice/CCR001-052026?t=');
    expect(message).not.toContain('{parent_name}');
    expect(message).not.toContain('{invoice_number}');
    expect(message).not.toContain('{amount}');
    expect(message).not.toContain('{paid_date}');
    expect(message).not.toContain('{invoice_url}');
  });
});
