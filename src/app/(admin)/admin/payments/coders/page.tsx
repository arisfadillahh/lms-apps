import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { usersDao } from '@/lib/dao';
import AssignPaymentButton from './AssignPaymentButton';

export default async function CoderPaymentsPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    // Fetch coders with their payment periods
    const coders = await usersDao.listUsersByRole('CODER');

    const { data: periods } = await supabase
        .from('coder_payment_periods')
        .select('*, payment_plans(*), pricing(*)')
        .order('end_date', { ascending: true });

    // Group periods by coder
    const coderPayments = new Map<string, typeof periods>();
    periods?.forEach((period) => {
        const existing = coderPayments.get(period.coder_id) || [];
        existing.push(period);
        coderPayments.set(period.coder_id, existing);
    });

    // Fetch plans and pricing for the button
    const [{ data: plans }, { data: pricing }] = await Promise.all([
        supabase.from('payment_plans').select('*').eq('is_active', true),
        supabase.from('pricing').select('*, levels(name)').eq('is_active', true),
    ]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin/payments" style={backLinkStyle}>← Paket Pembayaran</Link>
                    <h1 style={titleStyle}>Periode Belajar Coder</h1>
                    <p style={subtitleStyle}>Lihat dan atur periode belajar aktif untuk setiap coder</p>
                </div>
            </header>

            <div style={cardContainerStyle}>
                {coders.map((coder) => {
                    const coderPeriods = coderPayments.get(coder.id) || [];
                    const activePeriod = coderPeriods.find((p: any) => p.status === 'ACTIVE');

                    return (
                        <div key={coder.id} style={cardStyle}>
                            <div style={cardHeaderStyle}>
                                <div>
                                    <h3 style={coderNameStyle}>{coder.full_name}</h3>
                                    <span style={usernameStyle}>@{coder.username}</span>
                                </div>
                                <AssignPaymentButton
                                    coderId={coder.id}
                                    coderName={coder.full_name}
                                    plans={plans || []}
                                    pricing={pricing || []}
                                />
                            </div>

                            {activePeriod ? (
                                <div style={activePeriodStyle}>
                                    <div style={periodInfoStyle}>
                                        <span style={periodLabelStyle}>Periode Aktif</span>
                                        <span style={periodValueStyle}>
                                            {formatDate(activePeriod.start_date)} - {formatDate(activePeriod.end_date)}
                                        </span>
                                    </div>
                                    <div style={periodInfoStyle}>
                                        <span style={periodLabelStyle}>Total</span>
                                        <span style={periodValueStyle}>{formatCurrency(activePeriod.total_amount)}</span>
                                    </div>
                                    <div style={daysLeftStyle}>
                                        {(() => {
                                            const daysLeft = Math.ceil((new Date(activePeriod.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                            if (daysLeft < 0) return <span style={{ color: '#dc2626' }}>Expired</span>;
                                            if (daysLeft <= 7) return <span style={{ color: '#f59e0b' }}>{daysLeft} hari lagi</span>;
                                            return <span style={{ color: '#16a34a' }}>{daysLeft} hari lagi</span>;
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div style={noPeriodStyle}>
                                    Belum ada periode aktif
                                </div>
                            )}
                        </div>
                    );
                })}
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

const cardContainerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1rem',
};

const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    padding: '1rem',
};

const cardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
};

const coderNameStyle: CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
};

const usernameStyle: CSSProperties = {
    fontSize: '0.8rem',
    color: '#64748b',
};

const activePeriodStyle: CSSProperties = {
    background: '#f0fdf4',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
};

const periodInfoStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
};

const periodLabelStyle: CSSProperties = {
    color: '#64748b',
};

const periodValueStyle: CSSProperties = {
    color: '#0f172a',
    fontWeight: 500,
};

const daysLeftStyle: CSSProperties = {
    textAlign: 'right',
    fontSize: '0.85rem',
    fontWeight: 600,
};

const noPeriodStyle: CSSProperties = {
    padding: '0.75rem',
    background: '#f8fafc',
    borderRadius: '0.5rem',
    color: '#64748b',
    fontSize: '0.85rem',
    textAlign: 'center',
};
