import { createHmac, timingSafeEqual } from 'crypto';

type InvoicePublicAccessRecord = {
  invoice_number: string;
  parent_phone: string;
  total_amount: number;
};

function getInvoicePublicTokenSecret(): string {
  const secret = process.env.INVOICE_PUBLIC_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('Missing INVOICE_PUBLIC_TOKEN_SECRET or NEXTAUTH_SECRET');
  }

  return secret;
}

function normalizeTokenInput(invoice: InvoicePublicAccessRecord): string {
  return [
    invoice.invoice_number,
    invoice.parent_phone.replace(/\D/g, ''),
    Math.round(Number(invoice.total_amount) || 0).toString(),
  ].join('|');
}

export function createInvoicePublicToken(invoice: InvoicePublicAccessRecord): string {
  return createHmac('sha256', getInvoicePublicTokenSecret()).update(normalizeTokenInput(invoice)).digest('base64url');
}

export function verifyInvoicePublicToken(invoice: InvoicePublicAccessRecord, token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }

  const expectedToken = createInvoicePublicToken(invoice);
  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(token);

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function buildInvoicePublicUrl(baseUrl: string, invoice: InvoicePublicAccessRecord): string {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const token = createInvoicePublicToken(invoice);

  return `${normalizedBaseUrl}/invoice/${encodeURIComponent(invoice.invoice_number)}?t=${encodeURIComponent(token)}`;
}
