import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import DeletePlanButton from './DeletePlanButton';
import EkskulLessonList from './EkskulLessonList';

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function EkskulPlanDetailPage({ params }: PageProps) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const resolvedParams = await params;
    const planId = resolvedParams.id;

    const supabase = getSupabaseAdmin();

    const [{ data: plan }, { data: lessons }] = await Promise.all([
        supabase.from('ekskul_lesson_plans').select('*').eq('id', planId).single(),
        supabase.from('ekskul_lessons').select('*').eq('plan_id', planId).order('order_index', { ascending: true }),
    ]);

    if (!plan) notFound();

    const totalMeetings = (lessons || []).reduce((sum, l) => sum + (l.estimated_meetings || 1), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin/ekskul" style={backLinkStyle}>← Semua Lesson Plans</Link>
                    <h1 style={titleStyle}>{plan.name}</h1>
                    {plan.description && <p style={subtitleStyle}>{plan.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <DeletePlanButton planId={planId} planName={plan.name} />
                </div>
            </header>

            <div style={statsRowStyle}>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Total Lesson</span>
                    <span style={statValueStyle}>{(lessons || []).length}</span>
                </div>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Total Pertemuan</span>
                    <span style={statValueStyle}>{totalMeetings}</span>
                </div>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Status</span>
                    <span style={{ color: plan.is_active ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {plan.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                </div>
            </div>

            <EkskulLessonList planId={planId} lessons={(lessons || []) as any} />
        </div>
    );
}

const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' };
const backLinkStyle: CSSProperties = { color: '#1e3a5f', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'inline-block' };
const titleStyle: CSSProperties = { fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 };
const subtitleStyle: CSSProperties = { color: '#64748b', fontSize: '0.9rem' };
const statsRowStyle: CSSProperties = { display: 'flex', gap: '1rem' };
const statCardStyle: CSSProperties = { background: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const statLabelStyle: CSSProperties = { fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 };
const statValueStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' };
