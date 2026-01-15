'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

type LessonData = {
    lesson: {
        id: string;
        title: string;
        summary: string | null;
        order_index: number;
        slide_url: string | null;
        coach_example_url: string | null;
    };
    template: {
        slide_url: string | null;
        example_url: string | null;
    } | null;
};

type BlockData = {
    id: string;
    block_name: string | null;
    status: string;
    start_date: string | null;
    end_date: string | null;
};

type AllLessonsModalProps = {
    block: BlockData;
    lessons: LessonData[];
    currentLessonId: string | null;
    nextLessonId: string | null;
    renderLessonItem: (lesson: LessonData, highlight?: 'current' | 'next') => React.ReactNode;
};

export default function AllLessonsModal({
    block,
    lessons,
    currentLessonId,
    nextLessonId,
    renderLessonItem,
}: AllLessonsModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                style={triggerButtonStyle}
            >
                Lihat semua lesson ({lessons.length} total) →
            </button>

            {isOpen ? (
                <div style={overlayStyle} onClick={() => setIsOpen(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={modalHeaderStyle}>
                            <div>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a' }}>
                                    {block.block_name ?? 'Block'} - Semua Lesson
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                    {formatDate(block.start_date)} – {formatDate(block.end_date)} • {lessons.length} lessons
                                </p>
                            </div>
                            <button type="button" onClick={() => setIsOpen(false)} style={closeButtonStyle}>
                                ×
                            </button>
                        </div>

                        <div style={modalBodyStyle}>
                            {lessons.map(({ lesson, template }) => {
                                const highlight =
                                    lesson.id === currentLessonId ? 'current' : lesson.id === nextLessonId ? 'next' : undefined;
                                return (
                                    <div key={lesson.id}>
                                        {renderLessonItem({ lesson, template }, highlight)}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={modalFooterStyle}>
                            <button type="button" onClick={() => setIsOpen(false)} style={closeActionButtonStyle}>
                                Tutup
                            </button>
                        </div>
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
    color: '#1e3a5f',
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
