import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('invoice WhatsApp target contract', () => {
  it('uses the connected WhatsApp number first on public invoice confirmation', () => {
    const source = readSource('src/app/(public)/invoice/[invoiceNumber]/page.tsx');

    expect(source).toContain("import { getWhatsAppStatus } from '@/lib/services/whatsappClient'");
    expect(source).toContain('waConnectedNumber = waStatus.connectedPhone');
    expect(source).toContain('admin_whatsapp_number: waConnectedNumber || settings.admin_whatsapp_number');
  });

  it('opens wa.me using the configured admin WhatsApp number from bank info', () => {
    const source = readSource('src/app/(public)/invoice/[invoiceNumber]/InvoiceView.tsx');

    expect(source).toContain('bankInfo.admin_whatsapp_number.replace');
    expect(source).toContain('window.open(`https://wa.me/${normalizedPhone}?text=${message}`,');
  });

  it('sends admin payment confirmation to the invoice parent phone', () => {
    const source = readSource('src/app/api/invoices/[id]/route.ts');

    expect(source).toContain('resolvePaymentConfirmationTarget(invoice)');
    expect(source).toContain('const waResult = await sendWhatsAppMessage(targetPhone, message)');
    expect(source).toContain("console.log('[API] Payment confirmation sent to', targetPhone)");
  });
});
