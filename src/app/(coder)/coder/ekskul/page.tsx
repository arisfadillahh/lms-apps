import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export default async function CoderEkskulPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'CODER');

    const supabase = getSupabaseAdmin();

    // Get coder's enrolled EKSKUL classes
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
      id,
      classes!inner(
        id,
        name,
        type,
        schedule_day,
        schedule_time,
        ekskul_lesson_plan_id
      )
    `)
        .eq('coder_id', session.user.id)
        .eq('status', 'ACTIVE');

    // Filter only EKSKUL classes
    const ekskulClasses = (enrollments || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((e: any) => e.classes?.type === 'EKSKUL')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => e.classes);

    // Fetch ekskul lesson plans with lessons for each class
    const classesWithLessons = await Promise.all(
        ekskulClasses.map(async (klass: any) => {
            if (!klass.ekskul_lesson_plan_id) {
                return { ...klass, plan: null, lessons: [] };
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: plan } = await (supabase as any)
                .from('ekskul_lesson_plans')
                .select('name, description')
                .eq('id', klass.ekskul_lesson_plan_id)
                .single();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: lessons } = await (supabase as any)
                .from('ekskul_lessons')
                .select('*')
                .eq('plan_id', klass.ekskul_lesson_plan_id)
                .order('order_index', { ascending: true });

            return { ...klass, plan, lessons: lessons || [] };
        })
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header>
                <h1 style={titleStyle}>📚 Kelas Ekskul Saya</h1>
                <p style={subtitleStyle}>Lihat jadwal dan materi kelas ekskul yang kamu ikuti</p>
            </header>

            {classesWithLessons.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {classesWithLessons.map((klass: any) => (
                        <div key={klass.id} style={classCardStyle}>
                            <div style={classHeaderStyle}>
                                <h2 style={classNameStyle}>{klass.name}</h2>
                                <span style={scheduleStyle}>
                                    {klass.schedule_day} • {klass.schedule_time}
                                </span>
                            </div>

                            {klass.plan && (
                                <p style={planDescStyle}>
                                    <strong>{klass.plan.name}</strong>
                                    {klass.plan.description && ` - ${klass.plan.description}`}
                                </p>
                            )}

                            {klass.lessons.length > 0 ? (
                                <div style={lessonsGridStyle}>
                                    {klass.lessons.map((lesson: any, index: number) => (
                                        <div key={lesson.id} style={lessonCardStyle}>
                                            <div style={lessonNumStyle}>{index + 1}</div>
                                            <div style={{ flex: 1 }}>
                                                <h3 style={lessonTitleStyle}>{lesson.title}</h3>
                                                {lesson.summary && <p style={lessonSummaryStyle}>{lesson.summary}</p>}
                                                <div style={lessonMetaStyle}>
                                                    <span>📅 {lesson.estimated_meetings} pertemuan</span>
                                                    {lesson.slide_url && (
                                                        <a href={lesson.slide_url} target="_blank" rel="noopener noreferrer" style={slideLinkStyle}>
                                                            📖 Lihat Slide
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum ada materi untuk kelas ini</p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={emptyStyle}>
                    <p>Kamu belum terdaftar di kelas ekskul manapun.</p>
                    <Link href="/coder/dashboard" style={linkStyle}>← Kembali ke Dashboard</Link>
                </div>
            )}
        </div>
    );
}

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

const classCardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '1rem',
    border: '1px solid #e2e8f0',
    padding: '1.5rem',
};

const classHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
    gap: '0.5rem',
};

const classNameStyle: CSSProperties = {
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
};

const scheduleStyle: CSSProperties = {
    background: '#f1f5f9',
    padding: '0.25rem 0.75rem',
    borderRadius: '1rem',
    fontSize: '0.8rem',
    color: '#64748b',
};

const planDescStyle: CSSProperties = {
    color: '#64748b',
    fontSize: '0.9rem',
    marginBottom: '1rem',
};

const lessonsGridStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
};

const lessonCardStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    padding: '1rem',
    background: '#f8fafc',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
};

const lessonNumStyle: CSSProperties = {
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    background: '#7c3aed',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.85rem',
    flexShrink: 0,
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
    color: '#1e3a5f',
    fontWeight: 500,
    textDecoration: 'none',
};

const emptyStyle: CSSProperties = {
    padding: '3rem',
    textAlign: 'center',
    color: '#64748b',
    background: '#f8fafc',
    borderRadius: '1rem',
};

const linkStyle: CSSProperties = {
    color: '#1e3a5f',
    textDecoration: 'none',
    marginTop: '1rem',
    display: 'inline-block',
};
