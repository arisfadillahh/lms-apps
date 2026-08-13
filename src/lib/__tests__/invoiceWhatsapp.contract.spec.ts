import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('invoice WhatsApp target contract', () => {
  it('uses the configured admin WhatsApp number on the public invoice', () => {
    const source = readSource('src/app/(public)/invoice/[invoiceNumber]/page.tsx');

    expect(source).toContain('admin_whatsapp_number: settings.admin_whatsapp_number');
  });

  it('opens plain wa.me without a prefilled message', () => {
    const source = readSource('src/app/(public)/invoice/[invoiceNumber]/InvoiceView.tsx');

    expect(source).toContain('bankInfo.admin_whatsapp_number.replace');
    expect(source).toContain("window.open(`https://wa.me/${normalizedPhone}`, '_blank')");
    expect(source).not.toContain('https://wa.me/${normalizedPhone}?text=');
  });

  it('sends admin payment confirmation to the invoice parent phone', () => {
    const source = readSource('src/app/api/invoices/[id]/route.ts');

    expect(source).toContain('resolvePaymentConfirmationTarget(invoice)');
    expect(source).toContain('const waResult = await sendWhatsAppMessage(targetPhone, message)');
    expect(source).toContain("console.log('[API] Payment confirmation sent to', targetPhone)");
  });

  it('skips LMS generic payment confirmation for Event Manager invoices', () => {
    const source = readSource('src/app/api/invoices/[id]/route.ts');

    expect(source).toContain('resolveExternalReference(invoice)');
    expect(source).toContain('Skipped LMS generic payment confirmation for Event Manager invoice');
    expect(source).toContain('notifyEventManagerInvoiceStatus(invoiceForWebhook,');
  });

  it('allows Event Manager to mark an LMS invoice as paid through service token API', () => {
    const middlewareSource = readSource('middleware.ts');
    const routeSource = readSource('src/app/api/invoices/[id]/mark-paid/route.ts');

    expect(middlewareSource).toContain("segments[3] === 'mark-paid'");
    expect(routeSource).toContain('markInvoiceAsPaid(id, paidAt, paidNotes)');
    expect(routeSource).toContain("status: 'paid'");
    expect(routeSource).toContain("reason: 'skipped_by_request_origin'");
  });

  it('allows Event Manager to sync invoice display metadata through service token API', () => {
    const middlewareSource = readSource('middleware.ts');
    const routeSource = readSource('src/app/api/invoices/[id]/route.ts');
    const daoSource = readSource('src/lib/dao/invoicesDao.ts');

    expect(middlewareSource).toContain("method === 'PATCH' && segments.length === 3");
    expect(routeSource).toContain("action === 'update_metadata'");
    expect(routeSource).toContain('updateExternalInvoiceMetadata(id');
    expect(daoSource).toContain('updateExternalInvoiceMetadata');
    expect(daoSource).toContain('seasonal_student_name');
  });

  it('creates secure internal short links for invoice WhatsApp URLs', () => {
    const middlewareSource = readSource('middleware.ts');
    const shortLinkRoute = readSource('src/app/api/short-links/route.ts');
    const redirectRoute = readSource('src/app/i/[slug]/route.ts');
    const invoiceRoute = readSource('src/app/api/invoices/route.ts');
    const shortLinkService = readSource('src/lib/services/shortLinks.ts');

    expect(middlewareSource).toContain("'/i'");
    expect(middlewareSource).toContain("request.nextUrl.pathname === '/api/short-links'");
    expect(shortLinkRoute).toContain('assertCoreApiToken(request)');
    expect(redirectRoute).toContain('resolveShortLinkTarget(slug)');
    expect(invoiceRoute).toContain('short_payment_link: shortPaymentLink');
    expect(shortLinkService).toContain("parsed.pathname.startsWith('/invoice/')");
    expect(shortLinkService).toContain('crypto.randomBytes');
  });

  it('creates tokenized certificates through LMS Core service API', () => {
    const middlewareSource = readSource('middleware.ts');
    const routeSource = readSource('src/app/api/certificates/generate/route.ts');
    const pageSource = readSource('src/app/certificate/[token]/page.tsx');
    const serviceSource = readSource('src/lib/services/certificates.ts');

    expect(middlewareSource).toContain("'/certificate'");
    expect(middlewareSource).toContain("request.nextUrl.pathname === '/api/certificates/generate'");
    expect(routeSource).toContain('assertCoreApiToken(request)');
    expect(routeSource).toContain('certificateSchema.safeParse(body)');
    expect(pageSource).toContain('getCertificateByToken(token)');
    expect(serviceSource).toContain("crypto.randomBytes(18).toString('base64url')");
    expect(serviceSource).toContain('mode: 0o600');
  });

  it('waits for WhatsApp reconnect before failing external sends', () => {
    const source = readSource('src/lib/services/whatsappClient.ts');

    expect(source).toContain('async function waitForWhatsAppConnection');
    expect(source).toContain('if (!await waitForWhatsAppConnection())');
    expect(source).toContain("return { success: false, error: 'WhatsApp not connected' }");
  });

  it('allows external WhatsApp sends to group JIDs', () => {
    const source = readSource('src/lib/services/whatsappClient.ts');

    expect(source).toContain('function resolveWhatsAppTarget');
    expect(source).toContain('/^\\d+@g\\.us$/i.test(trimmed)');
    expect(source).toContain("return { kind: 'group', jid: trimmed }");
    expect(source).toContain("if (target.kind === 'personal')");
  });
});
