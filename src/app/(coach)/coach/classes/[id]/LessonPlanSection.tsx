'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { ClassLessonRecord } from '@/lib/dao/classLessonsDao';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import LessonPlanItem from './LessonPlanItem';
import { ChevronRight } from 'lucide-react';

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
        return <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>Belum ada block kurikulum.</p>;
    }

    // Find the active block: CURRENT status, or if none, the first one with lessons
    const activeBlock = blockLessons.find(({ block }) => block.status === 'CURRENT')
        ?? blockLessons.find(({ lessons }) => lessons.length > 0)
        ?? blockLessons[0];

    if (!activeBlock) {
        return <p style={{ color: '#6b7280', textAlign: 'center' }}>Block tidak ditemukan.</p>;
    }

    const { block, lessons } = activeBlock;

    // Find index of current or next lesson
    let startIdx = 0;
    const currentIdx = lessons.findIndex(({ lesson }) => lesson.id === currentLessonId);
    const nextIdx = lessons.findIndex(({ lesson }) => lesson.id === nextLessonId);

    if (currentIdx >= 0) {
        startIdx = Math.max(0, currentIdx - 1); // Show 1 before current if possible
    } else if (nextIdx >= 0) {
        startIdx = Math.max(0, nextIdx - 1);
    }

    // Get only 3-4 lessons to keep it compact
    const visibleLessons = lessons.slice(startIdx, startIdx + 4);
    const hasMoreLessons = lessons.length > 4;

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={lessonBlockStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                            <strong style={{ color: '#1e293b', fontSize: '1rem' }}>{block.block_name ?? 'Block'}</strong>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem' }}>
                                {formatDate(block.start_date)} – {formatDate(block.end_date)}
                            </div>
                        </div>
                        <span style={lessonBlockStatusBadge(block.status)}>{block.status}</span>
                    </div>

                    {lessons.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>Lesson template belum tersedia.</p>
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
                                    Lihat semua lesson ({lessons.length} total) <ChevronRight size={14} />
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
                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                                                {block.block_name ?? 'Block'}
                                            </h3>
                                            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                                Daftar Lengkap Lesson ({lessons.length} item)
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
    return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

const lessonBlockStyle: CSSProperties = {

};

const lessonBlockStatusBadge = (status: string): CSSProperties => ({
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: status === 'COMPLETED' ? '#16a34a' : status === 'CURRENT' ? '#1d4ed8' : '#c2410c',
    background: status === 'COMPLETED' ? '#dcfce7' : status === 'CURRENT' ? '#dbeafe' : '#ffedd5',
    textTransform: 'uppercase'
});

const triggerButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    width: '100%',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'background 0.2s',
};

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    padding: '1rem',
};

const modalStyle: CSSProperties = {
    width: 'min(700px, 95vw)',
    maxHeight: '90vh',
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
};

const modalHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
    background: '#fff',
};

const closeButtonStyle: CSSProperties = {
    border: 'none',
    background: 'transparent',
    fontSize: '2rem',
    lineHeight: 1,
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
};

const modalBodyStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    background: '#f8fafc',
};

const modalFooterStyle: CSSProperties = {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #e2e8f0',
    background: '#fff',
    display: 'flex',
    justifyContent: 'flex-end',
};

const closeActionButtonStyle: CSSProperties = {
    padding: '0.6rem 1.5rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#475569',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
};
