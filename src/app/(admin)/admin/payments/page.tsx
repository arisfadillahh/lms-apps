import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AddPaymentPlanButton from './AddPaymentPlanButton';
import EditPaymentPlanButton from './EditPaymentPlanButton';
import DeletePaymentPlanButton from './DeletePaymentPlanButton';
import SendRemindersButton from './expired/SendRemindersButton';

export default async function PaymentDashboardPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    // Fetch Stats
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const [
        { count: activeCount },
        { count: dueSoonCount },
        { data: plans }
    ] = await Promise.all([
        supabase.from('coder_payment_periods').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('coder_payment_periods').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('end_date', nextWeekStr),
        supabase.from('payment_plans').select('*').order('duration_months', { ascending: true })
    ]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
            <header>
                <div style={{ marginBottom: '1rem' }}>
                    <h1 style={titleStyle}>Dashboard Pembayaran</h1>
                    <p style={subtitleStyle}>Pusat kontrol pembayaran, tagihan, dan reminder tagihan siswa.</p>
                </div>
            </header>

            {/* Stats Section */}
            <section style={statsGridStyle}>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Siswa Aktif Berbayar</span>
                    <strong style={statValueStyle}>{activeCount || 0}</strong>
                    <div style={{ height: '4px', width: '40px', background: '#3b82f6', borderRadius: '2px', marginTop: '0.5rem' }} />
                </div>
                <div style={{ ...statCardStyle, background: '#fff7ed', borderColor: '#fdba74' }}>
                    <span style={{ ...statLabelStyle, color: '#c2410c' }}>Jatuh Tempo (7 Hari)</span>
                    <strong style={{ ...statValueStyle, color: '#9a3412' }}>{dueSoonCount || 0}</strong>
                    <div style={{ height: '4px', width: '40px', background: '#f97316', borderRadius: '2px', marginTop: '0.5rem' }} />
                </div>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Status WhatsApp</span>
                    <strong style={{ ...statValueStyle, fontSize: '1.25rem', color: '#16a34a' }}>Server Ready</strong>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Stub Mode (Console)</span>
                </div>
            </section>

            {/* Quick Actions / Navigation */}
            <section>
                <h2 style={sectionTitleStyle}>Aksi Operasional</h2>
                <div style={actionGridStyle}>
                    <Link href="/admin/payments/coders" style={{ textDecoration: 'none' }}>
                        <div style={actionCardStyle} className="hover-card">
                            <h3 style={cardTitleStyle}>👥 Data Siswa & Tagihan</h3>
                            <p style={cardDescStyle}>Lihat daftar siswa, assign paket baru, dan cek status pembayaran individu.</p>
                            <span style={actionLinkStyle}>Buka Data Siswa →</span>
                        </div>
                    </Link>

                    <div style={actionCardStyle}>
                        <h3 style={cardTitleStyle}>📢 Reminder Serempak</h3>
                        <p style={cardDescStyle}>Kirim pengingat pembayaran ke <strong>SEMUA</strong> siswa yang jatuh tempo bulan ini/depan.</p>
                        <div style={{ marginTop: 'auto' }}>
                            <SendRemindersButton mode="BATCH" />
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                                *Mengirim ke semua periode aktif yg berakhir dalam 10 hari.
                            </p>
                        </div>
                    </div>

                    <Link href="/admin/payments/expired" style={{ textDecoration: 'none' }}>
                        <div style={{ ...actionCardStyle, background: '#fef2f2', borderColor: '#fecaca' }} className="hover-card-red">
                            <h3 style={{ ...cardTitleStyle, color: '#991b1b' }}>⚠️ Monitoring Expired</h3>
                            <p style={{ ...cardDescStyle, color: '#b91c1c' }}>Lihat periode yang sudah lewat jatuh tempo dan belum diperbarui.</p>
                            <span style={{ ...actionLinkStyle, color: '#dc2626' }}>Cek Data Expired →</span>
                        </div>
                    </Link>
                </div>
            </section>

            {/* Settings & Plans */}
            <section style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Pengaturan Paket & Harga</h2>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Link href="/admin/payments/pricing" style={secondaryButtonStyle}>Atur Harga per Level</Link>
                        <AddPaymentPlanButton />
                    </div>
                </div>

                {/* Plans Table (Existing) */}
                <div style={tableContainerStyle}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Daftar Paket Pembayaran</h3>
                    </div>
                    {plans && plans.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Nama Paket</th>
                                        <th style={thStyle}>Durasi</th>
                                        <th style={thStyle}>Diskon</th>
                                        <th style={thStyle}>Status</th>
                                        <th style={thStyle}>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plans.map((plan) => (
                                        <tr key={plan.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                            <td style={tdStyle}>
                                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{plan.name}</span>
                                            </td>
                                            <td style={tdStyle}>{plan.duration_months} bulan</td>
                                            <td style={tdStyle}>{plan.discount_percent}%</td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    padding: '0.25rem 0.6rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    background: plan.is_active ? '#dcfce7' : '#fee2e2',
                                                    color: plan.is_active ? '#16a34a' : '#dc2626',
                                                }}>
                                                    {plan.is_active ? 'Aktif' : 'Nonaktif'}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <EditPaymentPlanButton plan={plan} />
                                                    <DeletePaymentPlanButton planId={plan.id} planName={plan.name} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={emptyStyle}>
                            Belum ada paket pembayaran.
                        </div>
                    )}
                </div>
            </section>

            <style>{`
                .hover-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .hover-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
                .hover-card-red { transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .hover-card-red:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.1); }
            `}</style>
        </div>
    );
}

// Styles
const titleStyle: CSSProperties = { fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' };
const subtitleStyle: CSSProperties = { color: '#64748b', fontSize: '1rem', marginTop: '0.5rem', lineHeight: '1.6' };
const sectionTitleStyle: CSSProperties = { fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' };

const statsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' };
const statCardStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
};
const statLabelStyle: CSSProperties = { fontSize: '0.85rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
const statValueStyle: CSSProperties = { fontSize: '2.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 };

const actionGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' };
const actionCardStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '1.75rem',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    cursor: 'pointer'
};
const cardTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#1e293b' };
const cardDescStyle: CSSProperties = { fontSize: '0.95rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.6, flex: 1 };
const actionLinkStyle: CSSProperties = { fontSize: '0.9rem', color: '#3b82f6', fontWeight: 600, marginTop: 'auto' };

const secondaryButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    background: '#fff',
    color: '#334155',
    borderRadius: '10px',
    fontWeight: 600,
    textDecoration: 'none',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.2s'
};

const tableContainerStyle: CSSProperties = { background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '1rem 1.5rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: CSSProperties = { padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem' };
const emptyStyle: CSSProperties = { padding: '3rem', textAlign: 'center', color: '#94a3b8' };
