/**
 * Public Invoice Page by invoice ID.
 *
 * This avoids broken links when human invoice numbers contain "/" characters.
 */

import { notFound } from 'next/navigation';
import { getInvoiceById, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { verifyInvoicePublicToken } from '@/lib/services/invoicePublicAccess';
import { getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';
import { getStoredInvoicePaymentByInvoiceId, toPublicStoredInvoicePayment } from '@/lib/invoicePaymentStore';
import InvoiceView from '../../[invoiceNumber]/InvoiceView';

interface Props {
    params: Promise<{ invoiceId: string }>;
    searchParams: Promise<{ t?: string | string[] }>;
}

export default async function PublicInvoiceByIdPage({ params, searchParams }: Props) {
    const { invoiceId } = await params;
    const tokenParams = await searchParams;
    const token = Array.isArray(tokenParams.t) ? tokenParams.t[0] : tokenParams.t;

    const invoice = await getInvoiceById(invoiceId);

    if (!invoice || !verifyInvoicePublicToken(invoice, token)) {
        notFound();
    }

    const [settings, storedPayment] = await Promise.all([
        getInvoiceSettings(),
        getStoredInvoicePaymentByInvoiceId(invoice.id)
    ]);

    return (
        <InvoiceView
            invoice={invoice}
            publicToken={token}
            paymentOptions={getPublicInvoicePaymentOptions(invoice.total_amount)}
            initialPayment={storedPayment && token ? toPublicStoredInvoicePayment(storedPayment, token) : null}
            bankInfo={settings ? {
                bank_name: settings.bank_name,
                bank_account_number: settings.bank_account_number,
                bank_account_holder: settings.bank_account_holder,
                admin_whatsapp_number: settings.admin_whatsapp_number,
                weekly_invoice_message_template: settings.weekly_invoice_message_template
            } : null}
        />
    );
}

export async function generateMetadata({ params }: Props) {
    const { invoiceId } = await params;

    return {
        title: `Invoice ${invoiceId} - Clevio Innovator Camp`,
        description: `Tagihan kursus Clevio Innovator Camp - ${invoiceId}`,
    };
}

export const viewport = {
    width: 1024,
    initialScale: 0.35,
    maximumScale: 5,
    userScalable: true,
};
