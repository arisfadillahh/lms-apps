/**
 * Public Invoice Page
 * Route: /invoice/[invoiceNumber]
 * 
 * No authentication required. Displays invoice details with payment info.
 */

import { notFound } from 'next/navigation';
import { getInvoiceByNumber, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import InvoiceView from './InvoiceView';

interface Props {
    params: Promise<{ invoiceNumber: string }>;
}

export default async function PublicInvoicePage({ params }: Props) {
    const { invoiceNumber } = await params;

    // Fetch invoice data
    const invoice = await getInvoiceByNumber(invoiceNumber);

    if (!invoice) {
        notFound();
    }

    // Get settings for bank info
    const settings = await getInvoiceSettings();

    return (
        <InvoiceView
            invoice={invoice}
            bankInfo={settings ? {
                bank_name: settings.bank_name,
                bank_account_number: settings.bank_account_number,
                bank_account_holder: settings.bank_account_holder,
                admin_whatsapp_number: settings.admin_whatsapp_number
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

