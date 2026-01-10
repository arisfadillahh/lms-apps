import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { classLessonsDao, classesDao, lessonTemplatesDao } from '@/lib/dao';
import LessonPlanItem from '../LessonPlanItem';

type PageProps = {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ block?: string }>;
};

export default async function AllLessonsPage({ params, searchParams }: PageProps) {
    const session = await getSessionOrThrow();
    const resolvedParams = await params;
    const resolvedSearch = await searchParams;
    const classIdParam = decodeURIComponent(resolvedParams.id ?? '').trim();
    const blockIdParam = resolvedSearch.block ?? null;

    if (!classIdParam || !isValidUuid(classIdParam)) {
        return (
            <div style={containerStyle}>
                <p style={{ color: '#64748b' }}>Invalid class ID.</p>
                <Link href="/coach/dashboard" style={backLinkStyle}>← Kembali ke Dashboard</Link>
            </div>
        );
    }

    const classRecord = await classesDao.getClassById(classIdParam);

    if (!classRecord || classRecord.coach_id !== session.user.id) {
        return (
            <div style={containerStyle}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Class not found</h1>
                <p style={{ color: '#64748b' }}>You are not assigned to this class.</p>
                <Link href="/coach/dashboard" style={backLinkStyle}>← Kembali ke Dashboard</Link>
            </div>
        );
    }

    const classBlocks = await classesDao.getClassBlocks(classIdParam);
    const blockLessons = await Promise.all(
        classBlocks.map(async (block) => {
            const [lessons, templateLessons] = await Promise.all([
                classLessonsDao.listLessonsByClassBlock(block.id),
                block.block_id ? lessonTemplatesDao.listLessonsByBlock(block.block_id) : [],
            ]);
            const templateById = new Map(templateLessons.map((template) => [template.id, template]));
            const orderedLessons = lessons.slice().sort((a, b) => a.order_index - b.order_index);
            const lessonsWithTemplate = orderedLessons.map((lesson) => ({
                lesson,
                template: lesson.lesson_template_id ? templateById.get(lesson.lesson_template_id) ?? null : null,
            }));
            return {
                block,
                lessons: lessonsWithTemplate,
            };
        }),
    );

    // Filter to specific block if provided
    const filteredBlockLessons = blockIdParam
        ? blockLessons.filter(({ block }) => block.id === blockIdParam)
        : blockLessons;

    return (
        <div style={containerStyle}>
            <header style={{ marginBottom: '1.5rem' }}>
                <Link href={`/coach/classes/${classIdParam}`} style={backLinkStyle}>
                    ← Kembali ke {classRecord.name}
                </Link>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginTop: '0.75rem' }}>
                    Semua Lesson Plan
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    {classRecord.name} • {classRecord.type}
                </p>
            </header>

            {filteredBlockLessons.length === 0 ? (
                <p style={{ color: '#6b7280' }}>Belum ada block yang diinstansiasi.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {filteredBlockLessons.map(({ block, lessons }) => (
                        <section key={block.id} style={cardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    <strong style={{ color: '#0f172a', fontSize: '1.1rem' }}>{block.block_name ?? 'Block'}</strong>
                                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
                                        <span>{formatDate(block.start_date)} – {formatDate(block.end_date)}</span>
                                        <span>Status: {block.status}</span>
                                        <span>{lessons.length} lessons</span>
                                    </div>
                                </div>
                                <span style={lessonBlockStatusBadge(block.status)}>{block.status}</span>
                            </div>

                            {lessons.length === 0 ? (
                                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Lesson template belum tersedia.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {lessons.map(({ lesson, template }) => (
                                        <LessonPlanItem key={lesson.id} lesson={lesson} template={template} />
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}

function isValidUuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
}

const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '1000px',
    width: '100%',
    margin: '0 auto',
    padding: '0 1.25rem 2.5rem',
};

const backLinkStyle: CSSProperties = {
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.9rem',
};

const cardStyle: CSSProperties = {
    background: 'var(--color-bg-surface)',
    width: '100%',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    padding: '1.25rem 1.5rem',
    boxShadow: 'var(--shadow-medium)',
};

const lessonBlockStatusBadge = (status: string): CSSProperties => ({
    padding: '0.25rem 0.65rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    color:
        status === 'COMPLETED' ? '#16a34a' : status === 'CURRENT' ? '#2563eb' : '#ea580c',
    background:
        status === 'COMPLETED'
            ? '#ecfdf3'
            : status === 'CURRENT'
                ? 'rgba(37, 99, 235, 0.12)'
                : 'rgba(234, 88, 12, 0.12)',
});
