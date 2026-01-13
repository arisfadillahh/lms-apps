import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import AddEkskulLessonButton from './AddEkskulLessonButton';
import EditEkskulLessonButton from './EditEkskulLessonButton';
import DeleteLessonButton from './DeleteLessonButton';
import DeletePlanButton from './DeletePlanButton';

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

    if (!plan) {
        notFound();
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin/ekskul" style={backLinkStyle}>← Semua Lesson Plans</Link>
                    <h1 style={titleStyle}>{plan.name}</h1>
                    {plan.description && <p style={subtitleStyle}>{plan.description}</p>}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <AddEkskulLessonButton planId={planId} suggestedOrderIndex={(lessons?.length || 0) + 1} />
                    <DeletePlanButton planId={planId} planName={plan.name} />
                </div>
            </header>

            <div style={statsRowStyle}>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Total Pertemuan</span>
                    <span style={statValueStyle}>
                        {(lessons || []).reduce((sum, lesson) => sum + (lesson.estimated_meetings || 1), 0)}
                    </span>
                </div>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Status</span>
                    <span style={{
                        color: plan.is_active ? '#16a34a' : '#dc2626',
                        fontWeight: 600,
                    }}>
                        {plan.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                </div>
            </div>

            <div>
                <h2 style={sectionTitleStyle}>📚 Daftar Lesson</h2>

                {lessons && lessons.length > 0 ? (
                    <div style={lessonListStyle}>
                        {lessons.map((lesson, index) => (
                            <div key={lesson.id} style={lessonCardStyle}>
                                <div style={lessonOrderStyle}>{index + 1}</div>
                                <div style={lessonContentStyle}>
                                    <h3 style={lessonTitleStyle}>{lesson.title}</h3>
                                    {lesson.summary && <p style={lessonSummaryStyle}>{lesson.summary}</p>}
                                    <div style={lessonMetaStyle}>
                                        <span>📅 {lesson.estimated_meetings} pertemuan</span>
                                        {lesson.slide_url && (
                                            <a href={lesson.slide_url} target="_blank" rel="noopener noreferrer" style={slideLinkStyle}>
                                                🔗 Slide
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <EditEkskulLessonButton lesson={lesson} planId={planId} />
                                    <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} planId={planId} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={emptyStyle}>
                        Belum ada lesson. Klik "Tambah Lesson" untuk memulai.
                    </div>
                )}
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

const statsRowStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
};

const statCardStyle: CSSProperties = {
    background: '#fff',
    padding: '1rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
};

const statLabelStyle: CSSProperties = {
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 600,
};

const statValueStyle: CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0f172a',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '1rem',
};

const lessonListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
};

const lessonCardStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    background: '#fff',
    padding: '1rem',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
};

const lessonOrderStyle: CSSProperties = {
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    background: '#7c3aed',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.9rem',
    flexShrink: 0,
};

const lessonContentStyle: CSSProperties = {
    flex: 1,
};

const lessonTitleStyle: CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
};

const lessonSummaryStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '0.25rem 0 0.5rem 0',
};

const lessonMetaStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.8rem',
    color: '#64748b',
};

const slideLinkStyle: CSSProperties = {
    color: '#2563eb',
    textDecoration: 'none',
};

const emptyStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '0.75rem',
};
