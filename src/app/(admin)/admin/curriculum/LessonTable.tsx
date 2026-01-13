'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Pencil } from 'lucide-react';

import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import EditLessonModal from './EditLessonModal';
import DeleteLessonButton from './DeleteLessonButton';

type LessonTableProps = {
    lessons: LessonTemplateRecord[];
};

export default function LessonTable({ lessons }: LessonTableProps) {
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

    // Sort by order_index
    const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index);

    const editingLesson = sortedLessons.find(l => l.id === editingLessonId);

    return (
        <>
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr style={headerRowStyle}>
                            <th style={{ ...thStyle, width: '60px' }}>#</th>
                            <th style={thStyle}>Judul</th>
                            <th style={thStyle}>Jml Pertemuan</th>
                            <th style={thStyle}>Slide</th>
                            <th style={thStyle}>Contoh Game</th>
                            <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedLessons.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={emptyCellStyle}>
                                    Belum ada lesson. Silakan tambah lesson baru.
                                </td>
                            </tr>
                        ) : null}
                        {sortedLessons.map((lesson) => (
                            <tr key={lesson.id} style={rowStyle}>
                                <td style={{ ...tdStyle, color: '#64748b' }}>{lesson.order_index + 1}</td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 500, color: '#0f172a' }}>{lesson.title}</span>
                                        {lesson.summary ? (
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {lesson.summary}
                                            </span>
                                        ) : null}
                                    </div>
                                </td>
                                <td style={{ ...tdStyle, color: '#475569' }}>
                                    {lesson.estimated_meeting_count ? `${lesson.estimated_meeting_count} Sesi` : '—'}
                                </td>
                                <td style={tdStyle}>
                                    {lesson.slide_url ? (
                                        <a href={lesson.slide_url} target="_blank" rel="noreferrer" style={linkStyle}>
                                            Open Slide ↗
                                        </a>
                                    ) : (
                                        <span style={{ color: '#cbd5e1' }}>—</span>
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    {lesson.example_url ? (
                                        <a href={lesson.example_url} target="_blank" rel="noreferrer" style={linkStyle}>
                                            View Example ↗
                                        </a>
                                    ) : (
                                        <span style={{ color: '#cbd5e1' }}>—</span>
                                    )}
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => setEditingLessonId(lesson.id)}
                                            style={iconButtonStyle}
                                            title="Edit Lesson"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingLesson ? (
                <EditLessonModal
                    open={!!editingLesson}
                    onOpenChange={(open) => !open && setEditingLessonId(null)}
                    lesson={editingLesson}
                />
            ) : null}
        </>
    );
}

// Styles
const tableContainerStyle: CSSProperties = {
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    overflow: 'hidden',
    background: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.9rem',
};

const headerRowStyle: CSSProperties = {
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
};

const thStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    fontWeight: 600,
    color: '#475569',
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.025em',
};

const rowStyle: CSSProperties = {
    borderBottom: '1px solid #f1f5f9',
};

const tdStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    verticalAlign: 'middle',
};

const emptyCellStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: '0.9rem',
    fontStyle: 'italic',
};

const linkStyle: CSSProperties = {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 500,
    fontSize: '0.85rem',
};

const iconButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.4rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    cursor: 'pointer',
    color: '#475569',
    width: '32px',
    height: '32px',
};
