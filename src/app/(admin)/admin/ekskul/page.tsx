import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AddEkskulPlanButton from './AddEkskulPlanButton';

export default async function EkskulPlansPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();
    const { data: plans } = await supabase
        .from('ekskul_lesson_plans')
        .select('*, ekskul_lessons(estimated_meetings)')
        .order('created_at', { ascending: false });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin" style={backLinkStyle}>← Dashboard Admin</Link>
                    <h1 style={titleStyle}>📚 Lesson Plan Ekskul</h1>
                    <p style={subtitleStyle}>Kelola template lesson plan untuk kelas Ekskul (reusable)</p>
                </div>
                <AddEkskulPlanButton />
            </header>

            {plans && plans.length > 0 ? (
                <div style={gridStyle}>
                    {plans.map((plan: any) => (
                        <Link
                            key={plan.id}
                            href={`/admin/ekskul/${plan.id}`}
                            style={cardStyle}
                        >
                            <div style={cardHeaderStyle}>
                                <h3 style={cardTitleStyle}>{plan.name}</h3>
                                <span style={{
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    background: plan.is_active ? '#dcfce7' : '#fee2e2',
                                    color: plan.is_active ? '#16a34a' : '#dc2626',
                                }}>
                                    {plan.is_active ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>
                            {plan.description && (
                                <p style={descStyle}>{plan.description}</p>
                            )}
                            <div style={statsStyle}>
                                <span>📖 {(plan.ekskul_lessons || []).reduce((sum: number, l: any) => sum + (l.estimated_meetings || 1), 0)} pertemuan</span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div style={emptyStyle}>
                    Belum ada lesson plan ekskul. Klik "Tambah Plan" untuk membuat.
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

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
};

const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    padding: '1.25rem',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.2s',
};

const cardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginBottom: '0.5rem',
};

const cardTitleStyle: CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
};

const descStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#64748b',
    marginBottom: '0.75rem',
    lineHeight: 1.4,
};

const statsStyle: CSSProperties = {
    fontSize: '0.8rem',
    color: '#64748b',
    display: 'flex',
    gap: '1rem',
};

const emptyStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '0.75rem',
};
