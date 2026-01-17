/**
 * Admin Settings Page
 * Route: /admin/settings
 * 
 * Index page linking to all settings sub-pages.
 */

import Link from 'next/link';
import { Receipt, MessageCircle } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div style={{ padding: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                Settings
            </h1>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
                Konfigurasi sistem LMS
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {/* Invoice Settings Card */}
                <Link href="/admin/settings/invoice" style={{ textDecoration: 'none' }}>
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            backgroundColor: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '16px'
                        }}>
                            <Receipt size={24} color="#3b82f6" />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                            Invoice Settings
                        </h3>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                            Konfigurasi jadwal invoice, informasi bank, dan template pesan
                        </p>
                    </div>
                </Link>

                {/* WhatsApp Settings Card */}
                <Link href="/admin/settings/whatsapp" style={{ textDecoration: 'none' }}>
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '24px',
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            backgroundColor: '#ecfdf5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '16px'
                        }}>
                            <MessageCircle size={24} color="#22c55e" />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                            WhatsApp Settings
                        </h3>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                            Koneksi WhatsApp, scan QR code, dan monitoring pesan
                        </p>
                    </div>
                </Link>
            </div>
        </div>
    );
}

export const metadata = {
    title: 'Settings - Admin',
    description: 'System settings'
};
