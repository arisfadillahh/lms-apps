'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, CheckSquare, Square } from 'lucide-react';

import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import EditLessonModal from './EditLessonModal';
import DeleteLessonButton from './DeleteLessonButton';

type LessonTableProps = {
    lessons: LessonTemplateRecord[];
};

export default function LessonTable({ lessons }: LessonTableProps) {
    const router = useRouter();
    const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // Sort by order_index
    const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index);

    const editingLesson = sortedLessons.find(l => l.id === editingLessonId);

    const toggleSelectAll = () => {
        if (selectedIds.size === sortedLessons.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sortedLessons.map(l => l.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Yakin ingin menghapus ${selectedIds.size} lesson terpilih?`)) return;
        setIsDeleting(true);
        try {
            const res = await fetch('/api/admin/curriculum/lessons/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lessonIds: Array.from(selectedIds) }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Gagal menghapus lesson');
            }

            setSelectedIds(new Set());
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Gagal menghapus lesson');
        } finally {
            setIsDeleting(false);
        }
    };

    const isAllSelected = sortedLessons.length > 0 && selectedIds.size === sortedLessons.length;

    return (
        <>
            <div style={tableContainerStyle}>
                {selectedIds.size > 0 && (
                    <div style={bulkActionStyle}>
                        <span>{selectedIds.size} lesson dipilih</span>
                        <button onClick={handleBulkDelete} disabled={isDeleting} style={bulkDeleteButtonStyle}>
                            {isDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
                        </button>
                    </div>
                )}
                <table style={tableStyle}>
                    <thead>
                        <tr style={headerRowStyle}>
                            <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>
                                <button
                                    onClick={toggleSelectAll}
                                    style={checkboxButtonStyle}
                                    title={isAllSelected ? "Batalkan pilihan" : "Pilih semua"}
                                >
                                    {isAllSelected ? (
                                        <CheckSquare size={20} color="#1e3a5f" strokeWidth={2.5} />
                                    ) : (
                                        <Square size={20} color="#cbd5e1" strokeWidth={2.5} />
                                    )}
                                </button>
                            </th>
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
                                <td colSpan={7} style={emptyCellStyle}>
                                    Belum ada lesson. Silakan tambah lesson baru.
                                </td>
                            </tr>
                        ) : null}
                        {sortedLessons.map((lesson) => {
                            const isSelected = selectedIds.has(lesson.id);
                            return (
                                <tr key={lesson.id} style={isSelected ? selectedRowStyle : rowStyle}>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        <button
                                            onClick={() => toggleSelect(lesson.id)}
                                            style={checkboxButtonStyle}
                                        >
                                            {isSelected ? (
                                                <CheckSquare size={20} color="#1e3a5f" strokeWidth={2.5} />
                                            ) : (
                                                <Square size={20} color="#cbd5e1" strokeWidth={2.5} />
                                            )}
                                        </button>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#64748b' }}>{lesson.order_index}</td>
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
                            );
                        })}
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
const bulkActionStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    background: '#fef2f2',
    borderBottom: '1px solid #fee2e2',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
    color: '#991b1b',
};

const checkboxButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const bulkDeleteButtonStyle: CSSProperties = {
    background: '#ef4444',
    color: 'white',
    border: 'none',
    padding: '0.35rem 0.75rem',
    borderRadius: '0.375rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const selectedRowStyle: CSSProperties = {
    borderBottom: '1px solid #f1f5f9',
    background: '#fefce8',
};

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
    color: '#1e3a5f',
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
