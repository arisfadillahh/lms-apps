/**
 * Public Invoice Page
 * Route: /invoice/[invoiceNumber]
 * 
 * No authentication required. Displays invoice details with payment info.
 */

import { notFound } from 'next/navigation';
import { getInvoiceByNumber, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { verifyInvoicePublicToken } from '@/lib/services/invoicePublicAccess';
import { getPublicInvoicePaymentOptions } from '@/lib/invoicePaymentMethods';
import { getStoredInvoicePaymentByInvoiceId, toPublicStoredInvoicePayment } from '@/lib/invoicePaymentStore';
import InvoiceView from './InvoiceView';

interface Props {
    params: Promise<{ invoiceNumber: string }>;
    searchParams: Promise<{ t?: string | string[] }>;
}

export default async function PublicInvoicePage({ params, searchParams }: Props) {
    const { invoiceNumber } = await params;
    const tokenParams = await searchParams;
    const token = Array.isArray(tokenParams.t) ? tokenParams.t[0] : tokenParams.t;

    // Fetch invoice data
    const invoice = await getInvoiceByNumber(invoiceNumber);

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
    const { invoiceNumber } = await params;

    return {
        title: `Invoice ${invoiceNumber} - Clevio Innovator Camp`,
        description: `Tagihan kursus Clevio Innovator Camp - ${invoiceNumber}`,
    };
}

export const viewport = {
    width: 1024,
    initialScale: 0.35, // Force zoom out to fit 1024px content on ~360-390px screens
    maximumScale: 5,
    userScalable: true,
};

