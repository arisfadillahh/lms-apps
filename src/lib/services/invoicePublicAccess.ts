import { createHmac, timingSafeEqual } from 'crypto';

type InvoicePublicAccessRecord = {
  id?: string;
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
  ].join('|');
}

function normalizeLegacyTokenInput(invoice: InvoicePublicAccessRecord): string {
  return [
    invoice.invoice_number,
    invoice.parent_phone.replace(/\D/g, ''),
    Math.round(Number(invoice.total_amount) || 0).toString(),
  ].join('|');
}

function createTokenFromInput(input: string): string {
  return createHmac('sha256', getInvoicePublicTokenSecret()).update(input).digest('base64url');
}

function tokenMatches(expectedToken: string, providedToken: string): boolean {
  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function createInvoicePublicToken(invoice: InvoicePublicAccessRecord): string {
  return createTokenFromInput(normalizeTokenInput(invoice));
}

export function verifyInvoicePublicToken(invoice: InvoicePublicAccessRecord, token: string | null | undefined): boolean {
  if (!token) {
    return false;
  }

  const stableToken = createInvoicePublicToken(invoice);
  if (tokenMatches(stableToken, token)) {
    return true;
  }

  return tokenMatches(createTokenFromInput(normalizeLegacyTokenInput(invoice)), token);
}

export function buildInvoicePublicUrl(baseUrl: string, invoice: InvoicePublicAccessRecord): string {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const token = createInvoicePublicToken(invoice);
  const publicSlug = invoice.id
    ? `id/${encodeURIComponent(invoice.id)}`
    : encodeURIComponent(invoice.invoice_number);

  return `${normalizedBaseUrl}/invoice/${publicSlug}?t=${encodeURIComponent(token)}`;
}
