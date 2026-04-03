/**
 * Public Invoice Page
 * Route: /invoice/[invoiceNumber]
 * 
 * No authentication required. Displays invoice details with payment info.
 */

import { notFound } from 'next/navigation';
import { getInvoiceByNumber, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { getWhatsAppStatus } from '@/lib/services/whatsappClient';
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
    
    // Get WA connected number
    let waConnectedNumber = '';
    try {
        const waStatus = await getWhatsAppStatus();
        if (waStatus && waStatus.connectedPhone) {
            waConnectedNumber = waStatus.connectedPhone;
        }
    } catch (e) {
        console.error("Could not fetch WA status", e);
    }

    return (
        <InvoiceView
            invoice={invoice}
            bankInfo={settings ? {
                bank_name: settings.bank_name,
                bank_account_number: settings.bank_account_number,
                bank_account_holder: settings.bank_account_holder,
                admin_whatsapp_number: waConnectedNumber || settings.admin_whatsapp_number,
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

