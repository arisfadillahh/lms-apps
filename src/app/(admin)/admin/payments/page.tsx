import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AddPaymentPlanButton from './AddPaymentPlanButton';

export default async function PaymentPlansPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();
    const { data: plans, error } = await supabase
        .from('payment_plans')
        .select('*')
        .order('duration_months', { ascending: true });

    if (error) {
        console.error('Error fetching payment plans:', error);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin" style={backLinkStyle}>← Dashboard Admin</Link>
                    <h1 style={titleStyle}>Paket Pembayaran</h1>
                    <p style={subtitleStyle}>Kelola paket durasi pembayaran (1 bulan, 3 bulan, dst)</p>
                </div>
                <AddPaymentPlanButton />
            </header>

            {plans && plans.length > 0 ? (
                <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Nama Paket</th>
                                <th style={thStyle}>Durasi</th>
                                <th style={thStyle}>Diskon</th>
                                <th style={thStyle}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((plan) => (
                                <tr key={plan.id}>
                                    <td style={tdStyle}>{plan.name}</td>
                                    <td style={tdStyle}>{plan.duration_months} bulan</td>
                                    <td style={tdStyle}>{plan.discount_percent}%</td>
                                    <td style={tdStyle}>
                                        <span style={{
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            background: plan.is_active ? '#dcfce7' : '#fee2e2',
                                            color: plan.is_active ? '#16a34a' : '#dc2626',
                                        }}>
                                            {plan.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={emptyStyle}>
                    Belum ada paket pembayaran. Klik tombol "Tambah Paket" untuk membuat paket baru.
                </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Link href="/admin/payments/pricing" style={linkButtonStyle}>
                    📊 Harga per Level
                </Link>
                <Link href="/admin/payments/coders" style={linkButtonStyle}>
                    👦 Periode Coder
                </Link>
                <Link href="/admin/payments/expired" style={{ ...linkButtonStyle, background: '#fef2f2', color: '#dc2626' }}>
                    ⚠️ Akan Expired
                </Link>
            </div>
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

const linkButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: '#f1f5f9',
    color: '#334155',
    borderRadius: '0.5rem',
    fontWeight: 600,
    textDecoration: 'none',
};
