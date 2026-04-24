/**
 * Admin Settings Page
 * Route: /admin/settings
 *
 * Index page linking to all settings sub-pages.
 */

import Link from 'next/link';
import { Receipt, MessageCircle } from 'lucide-react';
import PageHead from '@/components/admin/PageHead';

export default function SettingsPage() {
  return (
    <div className="col gap-4">
      <PageHead
        title="Settings"
        desc="Pusat konfigurasi invoice, WhatsApp, dan pengaturan penting operasional LMS."
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {/* Invoice Settings Card */}
        <Link href="/admin/settings/invoice" style={{ textDecoration: 'none' }}>
          <div className="card card-p" style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: 'var(--radius)',
              background: 'var(--accent-weak)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '16px', color: 'var(--accent)',
            }}>
              <Receipt size={24} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              Invoice Settings
            </div>
            <p className="muted" style={{ fontSize: '14px', margin: 0 }}>
              Konfigurasi jadwal invoice, informasi bank, dan template pesan
            </p>
          </div>
        </Link>

        {/* WhatsApp Settings Card */}
        <Link href="/admin/settings/whatsapp" style={{ textDecoration: 'none' }}>
          <div className="card card-p" style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: 'var(--radius)',
              background: '#ecfdf5', display: 'flex', alignItems: 'center',
              justifyContent: 'center', marginBottom: '16px', color: '#22c55e',
            }}>
              <MessageCircle size={24} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              WhatsApp Settings
            </div>
            <p className="muted" style={{ fontSize: '14px', margin: 0 }}>
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
  description: 'System settings',
};
