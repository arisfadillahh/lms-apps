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
                <Link href="/admin" style={backLinkStyle}>← Dashboard Admin</Link>
                <h1 style={titleStyle}>Dashboard Pembayaran</h1>
                <p style={subtitleStyle}>Pusat kontrol pembayaran, tagihan, dan reminder.</p>
            </header>

            {/* Stats Section */}
            <section style={statsGridStyle}>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Siswa Aktif Berbayar</span>
                    <strong style={statValueStyle}>{activeCount || 0}</strong>
                </div>
                <div style={{ ...statCardStyle, background: '#fff7ed', borderColor: '#fdba74' }}>
                    <span style={{ ...statLabelStyle, color: '#c2410c' }}>Jatuh Tempo (7 Hari)</span>
                    <strong style={{ ...statValueStyle, color: '#9a3412' }}>{dueSoonCount || 0}</strong>
                </div>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Status WhatsApp</span>
                    <strong style={{ ...statValueStyle, fontSize: '1.25rem', color: '#16a34a' }}>Server Ready</strong>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Stub Mode (Console)</span>
                </div>
            </section>

            {/* Quick Actions / Navigation */}
            <section>
                <h2 style={sectionTitleStyle}>Aksi Operasional</h2>
                <div style={actionGridStyle}>
                    <div style={actionCardStyle}>
                        <h3 style={cardTitleStyle}>👥 Data Siswa & Tagihan</h3>
                        <p style={cardDescStyle}>Lihat daftar siswa, assign paket baru, dan cek status pembayaran individu.</p>
                        <Link href="/admin/payments/coders" style={actionButtonStyle}>Buka Data Siswa →</Link>
                    </div>

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

                    <div style={actionCardStyle}>
                        <h3 style={cardTitleStyle}>⚠️ Monitoring Expired</h3>
                        <p style={cardDescStyle}>Lihat periode yang sudah lewat jatuh tempo dan belum diperbarui.</p>
                        <Link href="/admin/payments/expired" style={{ ...actionButtonStyle, background: '#fee2e2', color: '#dc2626' }}>
                            Cek Data Expired →
                        </Link>
                    </div>
                </div>
            </section>

            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

            {/* Settings & Plans (Collapsible-ish logic or just list) */}
            <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={sectionTitleStyle}>Pengaturan Paket & Harga</h2>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Link href="/admin/payments/pricing" style={secondaryButtonStyle}>Atur Harga per Level</Link>
                        <AddPaymentPlanButton />
                    </div>
                </div>

                {/* Plans Table (Existing) */}
                {plans && plans.length > 0 ? (
                    <div style={tableContainerStyle}>
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
            </section>
        </div>
    );
}

// Styles
const backLinkStyle: CSSProperties = { color: '#2563eb', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'inline-block' };
const titleStyle: CSSProperties = { fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', margin: 0 };
const subtitleStyle: CSSProperties = { color: '#64748b', fontSize: '1rem', marginTop: '0.25rem' };
const sectionTitleStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 600, color: '#1e293b', marginBottom: '1rem' };

const statsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' };
const statCardStyle: CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' };
const statLabelStyle: CSSProperties = { fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginBottom: '0.5rem' };
const statValueStyle: CSSProperties = { fontSize: '2rem', fontWeight: 700, color: '#0f172a' };

const actionGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' };
const actionCardStyle: CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%' };
const cardTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: '#0f172a' };
const cardDescStyle: CSSProperties = { fontSize: '0.9rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: 1.5, flex: 1 };
const actionButtonStyle: CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '0.75rem 1rem', background: '#f8fafc', color: '#0f172a', borderRadius: '0.5rem', fontWeight: 600, textDecoration: 'none', border: '1px solid #cbd5e1', width: '100%' };
const secondaryButtonStyle: CSSProperties = { padding: '0.5rem 1rem', background: '#fff', color: '#334155', borderRadius: '0.5rem', fontWeight: 500, textDecoration: 'none', border: '1px solid #cbd5e1', fontSize: '0.9rem' };

const tableContainerStyle: CSSProperties = { background: '#fff', borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '0.75rem 1rem', background: '#f8fafc', fontSize: '0.85rem', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' };
const tdStyle: CSSProperties = { padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155' };
const emptyStyle: CSSProperties = { padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '0.75rem' };

