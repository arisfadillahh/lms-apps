import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export default async function ExpiredPaymentsPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    // Fetch periods that are expiring soon or already expired
    const { data: periods } = await supabase
        .from('coder_payment_periods')
        .select('*, users!coder_payment_periods_coder_id_fkey(full_name, parent_contact_phone), payment_plans(*)')
        .eq('status', 'ACTIVE')
        .lte('end_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) // Next 7 days
        .order('end_date', { ascending: true });

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    };

    const getDaysStatus = (endDate: string) => {
        const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (days < 0) return { text: `Expired ${Math.abs(days)} hari`, color: '#dc2626', bg: '#fee2e2' };
        if (days === 0) return { text: 'Hari ini expired', color: '#ea580c', bg: '#ffedd5' };
        if (days <= 3) return { text: `H-${days}`, color: '#d97706', bg: '#fef3c7' };
        return { text: `H-${days}`, color: '#ca8a04', bg: '#fef9c3' };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin/payments" style={backLinkStyle}>← Paket Pembayaran</Link>
                    <h1 style={titleStyle}>⚠️ Akan Expired / Sudah Expired</h1>
                    <p style={subtitleStyle}>Daftar periode yang akan habis dalam 7 hari atau sudah expired</p>
                </div>
            </header>

            {periods && periods.length > 0 ? (
                <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Coder</th>
                                <th style={thStyle}>Paket</th>
                                <th style={thStyle}>Berakhir</th>
                                <th style={thStyle}>Total</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>No. HP Ortu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {periods.map((period: any) => {
                                const status = getDaysStatus(period.end_date);
                                return (
                                    <tr key={period.id}>
                                        <td style={tdStyle}>{period.users?.full_name || 'Unknown'}</td>
                                        <td style={tdStyle}>{period.payment_plans?.name || '-'}</td>
                                        <td style={tdStyle}>{formatDate(period.end_date)}</td>
                                        <td style={tdStyle}>{formatCurrency(period.total_amount)}</td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: status.bg,
                                                color: status.color,
                                            }}>
                                                {status.text}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            {period.users?.parent_contact_phone ? (
                                                <a
                                                    href={`https://wa.me/${period.users.parent_contact_phone.replace(/^0/, '62')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: '#16a34a', fontWeight: 500 }}
                                                >
                                                    📱 {period.users.parent_contact_phone}
                                                </a>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={emptyStyle}>
                    ✅ Tidak ada periode yang akan expired dalam 7 hari ke depan
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
    color: '#1e3a5f',
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
    overflow: 'auto',
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '700px',
};

const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    background: '#fef2f2',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#991b1b',
    borderBottom: '1px solid #fecaca',
    whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
};

const emptyStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#16a34a',
    background: '#f0fdf4',
    borderRadius: '0.75rem',
    fontWeight: 500,
};
