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
import { toPublicStoredInvoicePayment } from '@/lib/invoicePaymentStore';
import { getCurrentStoredInvoicePayment } from '@/lib/services/invoicePaymentInstructions';
import InvoiceView from './InvoiceView';
import { toPublicInvoice } from '@/lib/publicInvoice';
import { holidayInvoicePattern } from '@/lib/holidayClass';
import { normalizeIndonesianPhone } from '@/lib/phoneNumbers';
import HolidayInvoiceView from './HolidayInvoiceView';
import { holidayWalletConfig } from '@/lib/holidayPaymentOptions';

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
        getCurrentStoredInvoicePayment(invoice)
    ]);

    if (holidayInvoicePattern.test(invoice.invoice_number) && token) {
        // Existing Snap normalization has no verified wallet deeplink adapter.
        // Merchant activation alone must not expose an unusable payment method.
        const wallets=holidayWalletConfig(process.env);
        if(wallets.some(w=>w.merchantEnabled&&!w.available))console.warn('[Holiday Payment] Wallet activation requested; verified deeplink adapter still required.');
        const phone=normalizeIndonesianPhone(process.env.HOLIDAY_CS_WHATSAPP || settings?.admin_whatsapp_number || '');
        return <HolidayInvoiceView invoice={toPublicInvoice(invoice)} token={token}
            options={getPublicInvoicePaymentOptions(invoice.total_amount)}
            initialPayment={storedPayment ? toPublicStoredInvoicePayment(storedPayment,token) : null}
            initialExpiresAt={storedPayment?.expiresAt??invoice.midtrans_expires_at}
            csPhone={/^628\d{7,12}$/.test(phone)?phone:null}/>;
    }

    return (
        <InvoiceView
            invoice={toPublicInvoice(invoice)}
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

export async function generateViewport({params}:Props) {
  const {invoiceNumber}=await params;
  if(holidayInvoicePattern.test(invoiceNumber))return {width:'device-width',initialScale:1};
  return {
    width: 1024,
    initialScale: 0.35, // Force zoom out to fit 1024px content on ~360-390px screens
    maximumScale: 5,
    userScalable: true,
  };
}
