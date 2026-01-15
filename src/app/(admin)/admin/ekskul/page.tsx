import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AddEkskulPlanButton from './AddEkskulPlanButton';
import EditEkskulPlanButton from './EditEkskulPlanButton';

export default async function EkskulPlansPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();
    const { data: plans } = await supabase
        .from('ekskul_lesson_plans')
        .select('*, ekskul_lessons(estimated_meetings), ekskul_plan_software(software(id, name))')
        .order('created_at', { ascending: false });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin" style={backLinkStyle}>← Dashboard Admin</Link>
                    <h1 style={titleStyle}>Lesson Plan Ekskul</h1>
                    <p style={subtitleStyle}>Kelola template lesson plan untuk kelas Ekskul (reusable)</p>
                </div>
                <AddEkskulPlanButton />
            </header>

            {plans && plans.length > 0 ? (
                <div style={gridStyle}>
                    {plans.map((plan: any) => (
                        <div key={plan.id} style={cardWrapperStyle}>
                            <Link
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

                                <div style={{ marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                        {plan.ekskul_plan_software?.map((item: any) => (
                                            <span key={item.software.id} style={softwareTagStyle}>
                                                {item.software.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div style={statsStyle}>
                                    <span>📖 {(plan.ekskul_lessons || []).reduce((sum: number, l: any) => sum + (l.estimated_meetings || 1), 0)} pertemuan</span>
                                </div>
                            </Link>
                            <div style={cardActionsStyle}>
                                <EditEkskulPlanButton plan={plan} />
                            </div>
                        </div>
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

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
};

const cardWrapperStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.2s',
    overflow: 'hidden',
};

const cardStyle: CSSProperties = {
    padding: '1.25rem',
    textDecoration: 'none',
    color: 'inherit',
    flex: 1,
};

const cardActionsStyle: CSSProperties = {
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid #f1f5f9',
    background: '#f8fafc',
    display: 'flex',
    justifyContent: 'flex-end',
};

const softwareTagStyle: CSSProperties = {
    fontSize: '0.75rem',
    background: '#eff6ff',
    color: '#1e3a5f',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
    fontWeight: 500,
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
