/**
 * Admin Invoice Settings Page
 * Route: /admin/settings/invoice
 * 
 * Configure invoice generation settings, bank info, and admin contact.
 */

import { getInvoiceSettings } from '@/lib/dao/invoicesDao';
import InvoiceSettingsForm from './InvoiceSettingsForm';

export default async function InvoiceSettingsPage() {
    const settings = await getInvoiceSettings();

    return (
        <div style={{ padding: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                Invoice Settings
            </h1>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
                Konfigurasi pengaturan invoice dan informasi bank
            </p>

            <InvoiceSettingsForm initialSettings={settings} />
        </div>
    );
}

export const metadata = {
    title: 'Invoice Settings - Admin',
    description: 'Configure invoice settings'
};
