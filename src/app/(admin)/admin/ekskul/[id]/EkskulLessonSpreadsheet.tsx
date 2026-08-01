'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Save, ExternalLink, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { splitEkskulLessonMakeUp } from '@/lib/ekskulMakeUpInstructions';

type EkskulLesson = {
    id: string;
    title: string;
    summary: string | null;
    slide_url: string | null;
    make_up_instructions: string | null;
    estimated_meetings: number | null;
    order_index: number;
};

type EditableLesson = {
    id: string;
    title: string;
    summary: string;
    slide_url: string;
    make_up_instructions: string;
    estimated_meetings: number;
    order_index: number;
};

type Props = { lessons: EkskulLesson[]; planId: string; onClose?: () => void };

export default function EkskulLessonSpreadsheet({ lessons, planId, onClose }: Props) {
    const router = useRouter();
    const [items, setItems] = useState<EditableLesson[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index).map(l => {
            const lessonParts = splitEkskulLessonMakeUp(l.summary, l.make_up_instructions);
            return {
                id: l.id,
                title: l.title,
                summary: lessonParts.summary || '',
                slide_url: l.slide_url || '',
                make_up_instructions: lessonParts.makeUpInstructions || '',
                estimated_meetings: l.estimated_meetings || 1,
                order_index: l.order_index,
            };
        });
        setItems(sorted);
        setHasChanges(false);
    }, [lessons]);

    const handleReorder = (newOrder: EditableLesson[]) => {
        setItems(newOrder.map((item, index) => ({ ...item, order_index: index + 1 })));
        setHasChanges(true);
    };

    const handleChange = (id: string, field: keyof EditableLesson, value: any) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = items.map(item => ({
                id: item.id,
                title: item.title,
                summary: item.summary || null,
                slideUrl: item.slide_url || null,
                makeUpInstructions: item.make_up_instructions || null,
                estimatedMeetings: item.estimated_meetings,
                orderIndex: item.order_index,
            }));

            const res = await fetch('/api/admin/ekskul/lessons/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to save');
            }

            router.refresh();
            setHasChanges(false);
        } catch (error: any) {
            alert(`Gagal menyimpan: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const resetItems = () => {
        const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index).map(l => {
            const lessonParts = splitEkskulLessonMakeUp(l.summary, l.make_up_instructions);
            return {
                id: l.id,
                title: l.title,
                summary: lessonParts.summary || '',
                slide_url: l.slide_url || '',
                make_up_instructions: lessonParts.makeUpInstructions || '',
                estimated_meetings: l.estimated_meetings || 1,
                order_index: l.order_index,
            };
        });
        setItems(sorted);
        setHasChanges(false);
    };

    return (
        <div style={fullscreenStyle}>
            <div style={topBarStyle}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Mode Edit Massal — Ekskul Lessons</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={resetItems} disabled={!hasChanges || isSaving} style={{ ...cancelBtnStyle, opacity: hasChanges ? 1 : 0.5 }}>Reset</button>
                        <button onClick={handleSave} disabled={!hasChanges || isSaving} style={{ ...saveBtnStyle, opacity: hasChanges ? 1 : 0.5, background: hasChanges ? '#3b82f6' : '#94a3b8' }}>
                            {isSaving ? 'Menyimpan...' : 'Simpan'} <Save size={16} />
                        </button>
                    </div>
                    <div style={{ width: '1px', height: '20px', background: '#cbd5e1' }} />
                    {onClose && (
                        <button onClick={onClose} style={closeBtnStyle}><X size={20} /> Tutup</button>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <div style={{ overflowX: 'auto' }}>
                    <div style={tableContainerStyle}>
                        <div style={headerRowStyle}>
                            <div style={{ ...headerCellStyle, justifyContent: 'center' }}>#</div>
                            <div style={headerCellStyle}>Judul Lesson</div>
                            <div style={{ ...headerCellStyle, justifyContent: 'center' }}>Pertemuan</div>
                            <div style={headerCellStyle}>Ringkasan</div>
                            <div style={headerCellStyle}>Make-Up Task</div>
                            <div style={{ ...headerCellStyle, borderRight: 'none' }}>Slide URL</div>
                        </div>
                        <Reorder.Group axis="y" values={items} onReorder={handleReorder} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {items.map(item => (
                                <SpreadsheetRow key={item.id} item={item} onChange={handleChange} />
                            ))}
                        </Reorder.Group>
                        {items.length === 0 && (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                Belum ada lesson.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SpreadsheetRow({ item, onChange }: { item: EditableLesson; onChange: (id: string, field: keyof EditableLesson, value: any) => void }) {
    const dragControls = useDragControls();

    return (
        <Reorder.Item value={item} id={item.id} dragListener={false} dragControls={dragControls} style={rowStyle}>
            <div style={{ ...cellStyle, cursor: 'grab', justifyContent: 'center', alignItems: 'center', paddingTop: '0.8rem', color: '#64748b' }} onPointerDown={e => dragControls.start(e)}>
                <GripVertical size={20} />
            </div>
            <div style={cellStyle}>
                <textarea value={item.title} onChange={e => onChange(item.id, 'title', e.target.value)} style={textareaStyle} placeholder="Judul Lesson" rows={1} />
            </div>
            <div style={cellStyle}>
                <input type="number" min="0" value={item.estimated_meetings || ''} onChange={e => onChange(item.id, 'estimated_meetings', parseInt(e.target.value) || 0)} style={{ ...inputStyle, textAlign: 'center', height: 'auto', alignSelf: 'flex-start' }} />
            </div>
            <div style={cellStyle}>
                <textarea value={item.summary} onChange={e => onChange(item.id, 'summary', e.target.value)} style={textareaStyle} placeholder="Ringkasan materi..." />
            </div>
            <div style={cellStyle}>
                <textarea value={item.make_up_instructions} onChange={e => onChange(item.id, 'make_up_instructions', e.target.value)} style={textareaStyle} placeholder="Tugas otomatis kalau coder tidak hadir..." />
            </div>
            <div style={{ ...cellStyle, borderRight: 'none', position: 'relative' }}>
                <textarea value={item.slide_url} onChange={e => onChange(item.id, 'slide_url', e.target.value)} style={{ ...textareaStyle, paddingRight: '2rem', wordBreak: 'break-all' }} placeholder="https://..." rows={1} />
                {item.slide_url && (
                    <a href={item.slide_url} target="_blank" rel="noreferrer" style={{ position: 'absolute', right: '8px', top: '12px', color: '#3b82f6', zIndex: 10 }}><ExternalLink size={14} /></a>
                )}
            </div>
        </Reorder.Item>
    );
}

const gridTemplate = '50px 1.4fr 110px 1.6fr 1.8fr 1.4fr';

const fullscreenStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#f1f5f9', zIndex: 9999, display: 'flex', flexDirection: 'column' };
const topBarStyle: CSSProperties = { background: '#fff', padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const tableContainerStyle: CSSProperties = { border: '1px solid #94a3b8', borderRadius: '0.75rem', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', minWidth: '1280px' };
const headerRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: gridTemplate, borderBottom: '1px solid #94a3b8', background: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', alignItems: 'stretch' };
const headerCellStyle: CSSProperties = { padding: '0.8rem', borderRight: '1px solid #94a3b8', textAlign: 'left', display: 'flex', alignItems: 'center', height: '100%', fontWeight: 700 };
const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: gridTemplate, borderBottom: '1px solid #94a3b8', background: '#fff', minHeight: '60px', alignItems: 'stretch' };
const cellStyle: CSSProperties = { padding: '0', borderRight: '1px solid #94a3b8', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'stretch', position: 'relative' };
const inputStyle: CSSProperties = { width: '100%', height: '100%', padding: '0.8rem', border: 'none', background: 'transparent', fontSize: '0.9rem', color: '#0f172a', outline: 'none' };
const textareaStyle: CSSProperties = { ...inputStyle, resize: 'none', minHeight: '60px', fontFamily: 'inherit', lineHeight: '1.5', overflow: 'hidden', whiteSpace: 'pre-wrap', height: 'auto', display: 'block' };
const saveBtnStyle: CSSProperties = { background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '1.5rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' };
const cancelBtnStyle: CSSProperties = { background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 500 };
const closeBtnStyle: CSSProperties = { background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#475569', fontWeight: 500 };
