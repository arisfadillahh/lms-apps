/**
 * Admin Invoice Settings Page
 * Route: /admin/settings/invoice
 * 
 * Configure invoice generation settings, bank info, and admin contact.
 */

import { getInvoiceSettings } from '@/lib/dao/invoicesDao';
import InvoiceSettingsForm from './InvoiceSettingsForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InvoiceSettingsPage() {
    const settings = await getInvoiceSettings();

    return (
        <div>
            <div className="page-head"><div>
                <h1>Pengaturan Invoice</h1>
                <p>Atur jadwal, informasi pembayaran, dan template pesan WhatsApp dalam satu tempat.</p>
            </div></div>

            <InvoiceSettingsForm initialSettings={settings} checkoutEnabled={process.env.LMS_SELECTED_INVOICE_CHECKOUT_ENABLED === 'true'} />
        </div>
    );
}

export const metadata = {
    title: 'Invoice Settings - Admin',
    description: 'Configure invoice settings'
};
