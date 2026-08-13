'use client';

import { useState, type CSSProperties } from 'react';
import { CheckSquare, ExternalLink, Square, Table } from 'lucide-react';

import { splitEkskulLessonMakeUp } from '@/lib/ekskulMakeUpInstructions';
import AddEkskulLessonButton from './AddEkskulLessonButton';
import EditEkskulLessonButton from './EditEkskulLessonButton';
import DeleteLessonButton from './DeleteLessonButton';
import EkskulLessonSpreadsheet from './EkskulLessonSpreadsheet';
import ExportEkskulLessonsButton from './ExportEkskulLessonsButton';
import ImportEkskulLessonsButton from './ImportEkskulLessonsButton';

type EkskulLesson = {
    id: string;
    title: string;
    summary: string | null;
    slide_url: string | null;
    make_up_instructions: string | null;
    estimated_meetings: number | null;
    order_index: number;
    plan_id: string;
};

type Props = {
    planId: string;
    lessons: EkskulLesson[];
};

export default function EkskulLessonList({ planId, lessons }: Props) {
    const [isBulkEditMode, setIsBulkEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingLesson, setEditingLesson] = useState<EkskulLesson | null>(null);

    const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index);

    const toggleSelectAll = () => {
        if (selectedIds.size === sorted.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(sorted.map(l => l.id)));
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    if (isBulkEditMode) {
        return (
            <EkskulLessonSpreadsheet
                lessons={lessons}
                planId={planId}
                onClose={() => setIsBulkEditMode(false)}
            />
        );
    }

    return (
        <div className="ekskul-lesson-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Daftar Lesson</h3>
                <div className="ekskul-lesson-toolbar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <ExportEkskulLessonsButton planId={planId} />
                    <ImportEkskulLessonsButton planId={planId} currentLessonCount={lessons.length} />
                    <button
                        type="button"
                        onClick={() => setIsBulkEditMode(true)}
                        style={secondaryBtnStyle}
                    >
                        <Table size={16} /> Mode Edit Massal
                    </button>
                    <AddEkskulLessonButton planId={planId} suggestedOrderIndex={lessons.length + 1} />
                </div>
            </div>

            {/* Table */}
            <div className="ekskul-lesson-table-wrap ekskul-lesson-desktop" style={tableContainerStyle}>
                <table className="ekskul-lesson-table" style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: '40px' }}>
                                <button type="button" onClick={toggleSelectAll} style={checkboxBtnStyle} title="Pilih semua">
                                    {selectedIds.size === sorted.length && sorted.length > 0
                                        ? <CheckSquare size={20} color="#1e3a5f" />
                                        : <Square size={20} color="#cbd5e1" />}
                                </button>
                            </th>
                            <th style={{ ...thStyle, width: '50px' }}>No</th>
                            <th style={thStyle}>Judul Lesson</th>
                            <th style={thStyle}>Pertemuan</th>
                            <th style={thStyle}>Make-Up Task</th>
                            <th style={thStyle}>Slide</th>
                            <th style={{ ...thStyle, textAlign: 'center', width: '100px' }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                    Belum ada lesson. Klik &quot;+ Tambah Lesson&quot; untuk memulai.
                                </td>
                            </tr>
                        ) : (
                            sorted.map((lesson) => {
                                const isSelected = selectedIds.has(lesson.id);
                                const lessonParts = splitEkskulLessonMakeUp(lesson.summary, lesson.make_up_instructions);
                                return (
                                    <tr key={lesson.id} style={trStyle}>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <button type="button" onClick={() => toggleSelect(lesson.id)} style={checkboxBtnStyle}>
                                                    {isSelected ? <CheckSquare size={20} color="#1e3a5f" /> : <Square size={20} color="#cbd5e1" />}
                                                </button>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>{lesson.order_index}</td>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{lesson.title}</div>
                                            {lessonParts.summary && (
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                                                    {lessonParts.summary.length > 70 ? lessonParts.summary.slice(0, 70) + '...' : lessonParts.summary}
                                                </div>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            {lesson.estimated_meetings ? `${lesson.estimated_meetings} sesi` : '-'}
                                        </td>
                                        <td style={tdStyle}>
                                            {lessonParts.makeUpInstructions ? (
                                                <span style={taskBadgeStyle}>Ada task</span>
                                            ) : (
                                                <span style={{ color: '#cbd5e1' }}>-</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            {lesson.slide_url ? (
                                                <a href={lesson.slide_url} target="_blank" rel="noreferrer" style={linkStyle}>Link Slide</a>
                                            ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                                        </td>
                                        <td style={tdStyle}>
                    <div className="ekskul-lesson-actions" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                                <EditEkskulLessonButton lesson={lesson as any} planId={planId} />
                                                <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} planId={planId} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="ekskul-lesson-mobile-list">
                {sorted.length === 0 ? (
                    <div className="ekskul-lesson-empty">
                        Belum ada lesson. Tekan &quot;Tambah Lesson&quot; untuk memulai.
                    </div>
                ) : (
                    sorted.map((lesson) => {
                        const isSelected = selectedIds.has(lesson.id);
                        const lessonParts = splitEkskulLessonMakeUp(lesson.summary, lesson.make_up_instructions);

                        return (
                            <article key={lesson.id} className="ekskul-lesson-mobile-card">
                                <div className="ekskul-lesson-mobile-head">
                                    <button
                                        type="button"
                                        onClick={() => toggleSelect(lesson.id)}
                                        className="ekskul-lesson-mobile-select"
                                        aria-label={`${isSelected ? 'Batalkan pilihan' : 'Pilih'} ${lesson.title}`}
                                    >
                                        {isSelected ? <CheckSquare size={21} /> : <Square size={21} />}
                                    </button>
                                    <span className="ekskul-lesson-mobile-number">Lesson {lesson.order_index}</span>
                                    <span className="ekskul-lesson-mobile-session">
                                        {lesson.estimated_meetings ? `${lesson.estimated_meetings} sesi` : 'Belum diatur'}
                                    </span>
                                </div>

                                <div className="ekskul-lesson-mobile-content">
                                    <h4>{lesson.title}</h4>
                                    {lessonParts.summary ? <p>{lessonParts.summary}</p> : <p className="is-empty">Belum ada ringkasan.</p>}
                                </div>

                                <div className="ekskul-lesson-mobile-meta">
                                    <span className={lessonParts.makeUpInstructions ? 'is-ready' : 'is-empty'}>
                                        Make-up task: {lessonParts.makeUpInstructions ? 'Ada' : 'Belum ada'}
                                    </span>
                                    {lesson.slide_url ? (
                                        <a href={lesson.slide_url} target="_blank" rel="noreferrer">
                                            Buka slide <ExternalLink size={14} />
                                        </a>
                                    ) : (
                                        <span className="is-empty">Slide belum ada</span>
                                    )}
                                </div>

                                <div className="ekskul-lesson-mobile-actions">
                                    <EditEkskulLessonButton lesson={lesson as any} planId={planId} />
                                    <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} planId={planId} />
                                </div>
                            </article>
                        );
                    })
                )}
            </div>

            {selectedIds.size > 0 && (
                <div className="ekskul-lesson-bulk-actions" style={bulkActionsStyle}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedIds.size} lesson dipilih</span>
                    <button style={bulkClearBtnStyle} onClick={() => setSelectedIds(new Set())}>Batalkan Pilihan</button>
                </div>
            )}
        </div>
    );
}

const tableContainerStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '0.75rem', overflow: 'hidden' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: '0.9rem' };
const thStyle: CSSProperties = { padding: '0.75rem 1rem', textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
const trStyle: CSSProperties = { borderBottom: '1px solid #f1f5f9' };
const tdStyle: CSSProperties = { padding: '0.75rem 1rem', verticalAlign: 'middle', color: '#334155' };
const linkStyle: CSSProperties = { color: '#3b82f6', textDecoration: 'none', fontWeight: 500 };
const taskBadgeStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#ecfdf5', color: '#047857', fontSize: '0.75rem', fontWeight: 700 };
const checkboxBtnStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' };
const bulkActionsStyle: CSSProperties = { padding: '0.75rem 1rem', background: '#f1f5f9', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const bulkClearBtnStyle: CSSProperties = { padding: '0.4rem 0.8rem', borderRadius: '0.375rem', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer' };
const secondaryBtnStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#fff', color: '#1e3a5f', border: '1px solid #e2e8f0', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' };
