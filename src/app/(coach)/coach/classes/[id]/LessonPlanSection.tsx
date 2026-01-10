'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { ClassLessonRecord } from '@/lib/dao/classLessonsDao';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import LessonPlanItem from './LessonPlanItem';

type BlockData = {
    id: string;
    block_name?: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
};

type LessonData = {
    lesson: ClassLessonRecord;
    template: LessonTemplateRecord | null;
};

type LessonPlanSectionProps = {
    blockLessons: {
        block: BlockData & Record<string, unknown>;
        lessons: LessonData[];
    }[];
    currentLessonId: string | null;
    nextLessonId: string | null;
};

export default function LessonPlanSection({
    blockLessons,
    currentLessonId,
    nextLessonId,
}: LessonPlanSectionProps) {
    const [openModalBlockId, setOpenModalBlockId] = useState<string | null>(null);

    if (blockLessons.length === 0) {
        return <p style={{ color: '#6b7280' }}>Belum ada block yang diinstansiasi.</p>;
    }

    // Find the active block: CURRENT status, or if none, the first one with lessons
    const activeBlock = blockLessons.find(({ block }) => block.status === 'CURRENT')
        ?? blockLessons.find(({ lessons }) => lessons.length > 0)
        ?? blockLessons[0];

    if (!activeBlock) {
        return <p style={{ color: '#6b7280' }}>Belum ada block yang diinstansiasi.</p>;
    }

    const { block, lessons } = activeBlock;

    // Find index of current or next lesson
    let startIdx = 0;
    const currentIdx = lessons.findIndex(({ lesson }) => lesson.id === currentLessonId);
    const nextIdx = lessons.findIndex(({ lesson }) => lesson.id === nextLessonId);

    if (currentIdx >= 0) {
        startIdx = currentIdx;
    } else if (nextIdx >= 0) {
        startIdx = nextIdx;
    }

    // Get only 3 lessons: current/next + 2 more
    const visibleLessons = lessons.slice(startIdx, startIdx + 3);
    const hasMoreLessons = lessons.length > 3;

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={lessonBlockStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <strong style={{ color: '#0f172a' }}>{block.block_name ?? 'Block'}</strong>
                            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
                                <span>{formatDate(block.start_date)} – {formatDate(block.end_date)}</span>
                                <span>Status: {block.status}</span>
                            </div>
                        </div>
                        <span style={lessonBlockStatusBadge(block.status)}>{block.status}</span>
                    </div>

                    {lessons.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Lesson template belum tersedia.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {visibleLessons.map(({ lesson, template }) => {
                                const highlight =
                                    lesson.id === currentLessonId ? 'current' : lesson.id === nextLessonId ? 'next' : undefined;
                                return (
                                    <LessonPlanItem key={lesson.id} lesson={lesson} template={template} highlight={highlight} />
                                );
                            })}
                            {hasMoreLessons ? (
                                <button
                                    type="button"
                                    onClick={() => setOpenModalBlockId(block.id)}
                                    style={triggerButtonStyle}
                                >
                                    Lihat semua lesson ({lessons.length} total) →
                                </button>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {openModalBlockId ? (
                <div style={overlayStyle} onClick={() => setOpenModalBlockId(null)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        {(() => {
                            const blockData = blockLessons.find(({ block }) => block.id === openModalBlockId);
                            if (!blockData) return null;
                            const { block, lessons } = blockData;

                            return (
                                <>
                                    <div style={modalHeaderStyle}>
                                        <div>
                                            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>
                                                {block.block_name ?? 'Block'} - Semua Lesson
                                            </h3>
                                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                                {formatDate(block.start_date)} – {formatDate(block.end_date)} • {lessons.length} lessons
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => setOpenModalBlockId(null)} style={closeButtonStyle}>
                                            ×
                                        </button>
                                    </div>

                                    <div style={modalBodyStyle}>
                                        {lessons.map(({ lesson, template }) => {
                                            const highlight =
                                                lesson.id === currentLessonId ? 'current' : lesson.id === nextLessonId ? 'next' : undefined;
                                            return (
                                                <LessonPlanItem key={lesson.id} lesson={lesson} template={template} highlight={highlight} />
                                            );
                                        })}
                                    </div>

                                    <div style={modalFooterStyle}>
                                        <button type="button" onClick={() => setOpenModalBlockId(null)} style={closeActionButtonStyle}>
                                            Tutup
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            ) : null}
        </>
    );
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString();
}

const lessonBlockStyle: CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: '0.85rem',
    padding: '1rem 1.1rem',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
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

const triggerButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    border: '1px dashed #cbd5e1',
    background: 'rgba(37, 99, 235, 0.03)',
    color: '#2563eb',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    marginTop: '0.25rem',
};

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: '1rem',
};

const modalStyle: CSSProperties = {
    width: 'min(700px, 95vw)',
    maxHeight: '85vh',
    background: '#ffffff',
    borderRadius: '1rem',
    boxShadow: '0 25px 80px rgba(15, 23, 42, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
};

const modalHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
};

const closeButtonStyle: CSSProperties = {
    border: 'none',
    background: 'transparent',
    fontSize: '1.75rem',
    lineHeight: 1,
    cursor: 'pointer',
    color: '#64748b',
    padding: '0.25rem',
};

const modalBodyStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
};

const modalFooterStyle: CSSProperties = {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e2e8f0',
    background: '#f8fafc',
    display: 'flex',
    justifyContent: 'flex-end',
};

const closeActionButtonStyle: CSSProperties = {
    padding: '0.6rem 1.5rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
};
