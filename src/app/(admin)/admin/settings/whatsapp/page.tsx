/**
 * Admin WhatsApp Settings Page
 * Route: /admin/settings/whatsapp
 * 
 * WhatsApp connection management, QR code scanning, and message logs.
 */

import WhatsAppSettings from './WhatsAppSettings';

export default function WhatsAppSettingsPage() {
    return (
        <div style={{ padding: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                WhatsApp Settings
            </h1>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
                Koneksi WhatsApp dan monitoring pesan
            </p>

            <WhatsAppSettings />
        </div>
    );
}

export const metadata = {
    title: 'WhatsApp Settings - Admin',
    description: 'Manage WhatsApp connection and message logs'
};
