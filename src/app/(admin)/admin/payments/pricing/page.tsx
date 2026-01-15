import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { levelsDao } from '@/lib/dao';
import AddPricingButton from './AddPricingButton';
import PricingActions from './PricingActions';

export default async function PricingPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();
    const [{ data: pricing }, levels] = await Promise.all([
        supabase.from('pricing').select('*').order('created_at', { ascending: false }),
        levelsDao.listLevels(),
    ]);

    // Create a map of level names
    const levelMap = new Map(levels.map((l) => [l.id, l.name]));

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin/payments" style={backLinkStyle}>← Paket Pembayaran</Link>
                    <h1 style={titleStyle}>Harga per Level</h1>
                    <p style={subtitleStyle}>Kelola harga bulanan untuk setiap level dan mode (online/offline)</p>
                </div>
                <AddPricingButton levels={levels} />
            </header>

            {pricing && pricing.length > 0 ? (
                <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Level</th>
                                <th style={thStyle}>Mode</th>
                                <th style={thStyle}>Harga/Bulan</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pricing.map((item) => (
                                <tr key={item.id}>
                                    <td style={tdStyle}>{levelMap.get(item.level_id) || 'Unknown'}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            background: item.mode === 'ONLINE' ? '#dbeafe' : '#fef3c7',
                                            color: item.mode === 'ONLINE' ? '#1d4ed8' : '#b45309',
                                        }}>
                                            {item.mode}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>{formatCurrency(item.base_price_monthly)}</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            background: item.is_active ? '#dcfce7' : '#fee2e2',
                                            color: item.is_active ? '#16a34a' : '#dc2626',
                                        }}>
                                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        <PricingActions
                                            pricing={item}
                                            levels={levels}
                                            levelName={levelMap.get(item.level_id) || 'Unknown'}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={emptyStyle}>
                    Belum ada harga yang ditentukan. Klik tombol &quot;Tambah Harga&quot; untuk mulai.
                </div>
            )}
        </div>
    );
}

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
};

const backLinkStyle: CSSProperties = {
    color: '#2563eb',
    fontSize: '0.9rem',
    marginBottom: '0.5rem',
    display: 'inline-block',
};

const titleStyle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
};

const subtitleStyle: CSSProperties = {
    color: '#64748b',
    fontSize: '0.9rem',
};

const tableContainerStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    background: '#f8fafc',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#475569',
    borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
};

const emptyStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '0.75rem',
};
