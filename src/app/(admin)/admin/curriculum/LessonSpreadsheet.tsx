'use client';

import { useState, useEffect, useRef, CSSProperties } from 'react';
import { Reorder, useDragControls, motion } from 'framer-motion';
import { GripVertical, Save, Plus, Trash2, ExternalLink, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import DeleteLessonButton from './DeleteLessonButton'; // Reusing existing component for individual delete if needed, but we'll implement bulk/row delete mainly.

type LessonSpreadsheetProps = {
    lessons: LessonTemplateRecord[];
    blockId: string;
    onClose?: () => void;
};

type EditableLesson = {
    id: string;
    title: string;
    summary: string;
    slide_url: string;
    make_up_instructions: string;
    estimated_meeting_count: number;
    order_index: number;
    isNew?: boolean; // For tracking new rows before save? (Simplify: just editing existing for now, add requires modal or separate flow usually, but let's see)
    isDeleted?: boolean;
};

export default function LessonSpreadsheet({ lessons, blockId, onClose }: LessonSpreadsheetProps) {
    const router = useRouter();
    const [items, setItems] = useState<EditableLesson[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // Initialize items from props
        // Sort by order_index
        const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index).map(l => ({
            id: l.id,
            title: l.title,
            summary: l.summary || '',
            slide_url: l.slide_url || '',
            make_up_instructions: l.make_up_instructions || '',
            estimated_meeting_count: l.estimated_meeting_count || 0,
            order_index: l.order_index
        }));
        setItems(sorted);
        setHasChanges(false);
    }, [lessons]);

    const handleReorder = (newOrder: EditableLesson[]) => {
        // Preserve the existing numeric slots so archived lessons keep their historical order key.
        const orderSlots = [...items].map((item) => item.order_index).sort((a, b) => a - b);
        const reordered = newOrder.map((item, index) => ({
            ...item,
            order_index: orderSlots[index]
        }));
        setItems(reordered);
        setHasChanges(true);
    };

    const handleChange = (id: string, field: keyof EditableLesson, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Map to API payload
            const updates = items.map(item => ({
                id: item.id,
                title: item.title,
                summary: item.summary || null,
                slideUrl: item.slide_url || null,
                makeUpInstructions: item.make_up_instructions || null,
                estimatedMeetingCount: item.estimated_meeting_count, // Send 0 as 0, not null
                orderIndex: item.order_index
            }));

            const res = await fetch('/api/admin/curriculum/lessons/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error('Server Error:', errorData);
                throw new Error(errorData.error || 'Failed to save changes');
            }

            router.refresh();
            setHasChanges(false);
            // Optional: show toast success
        } catch (error: any) {
            console.error(error);
            alert(`Gagal menyimpan perubahan: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={fullscreenContainerStyle}>
            <div style={topBarStyle}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Mode Edit Massal</h2>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {/* Always show Reset/Save, disabled if no changes */}
                        <button
                            onClick={() => {
                                const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index).map(l => ({
                                    id: l.id,
                                    title: l.title,
                                    summary: l.summary || '',
                                    slide_url: l.slide_url || '',
                                    make_up_instructions: l.make_up_instructions || '',
                                    estimated_meeting_count: l.estimated_meeting_count || 0,
                                    order_index: l.order_index
                                }));
                                setItems(sorted);
                                setHasChanges(false);
                            }}
                            style={{
                                ...cancelButtonStyle,
                                opacity: hasChanges ? 1 : 0.5,
                                cursor: hasChanges ? 'pointer' : 'not-allowed'
                            }}
                            disabled={!hasChanges || isSaving}
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            style={{
                                ...saveButtonStyle,
                                opacity: hasChanges ? 1 : 0.5,
                                cursor: hasChanges ? 'pointer' : 'not-allowed',
                                background: hasChanges ? '#3b82f6' : '#94a3b8'
                            }}
                            disabled={!hasChanges || isSaving}
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan'}
                            <Save size={16} />
                        </button>
                    </div>
                    <div style={{ width: '1px', height: '20px', background: '#cbd5e1' }}></div>

                    {onClose && (
                        <button onClick={onClose} style={closeButtonStyle}>
                            <X size={20} /> Tutup
                        </button>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Floating Save Bar Removed - Moved to Top */}

                    <div style={tableContainerStyle}>
                        <div style={headerRowStyle}>
                            <div style={{ ...headerCellStyle, justifyContent: 'center', padding: '0.8rem' }}>#</div>
                            <div style={headerCellStyle}>Judul Lesson</div>
                            <div style={{ ...headerCellStyle, justifyContent: 'center' }}>Sesi</div>
                            <div style={headerCellStyle}>Ringkasan</div>
                            <div style={headerCellStyle}>Slide URL</div>
                            <div style={headerCellStyle}>Instruksi Makeup</div>
                            <div style={{ ...headerCellStyle, borderRight: 'none', justifyContent: 'center' }}>Aksi</div>
                        </div>

                        <Reorder.Group axis="y" values={items} onReorder={handleReorder} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {items.map((item) => (
                                <Row
                                    key={item.id}
                                    item={item}
                                    onChange={handleChange}
                                />
                            ))}
                        </Reorder.Group>

                        {items.length === 0 && (
                            <div style={emptyStyle}>
                                Belum ada lesson. Gunakan tombol "+ Lesson Baru" di atas untuk menambah.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ item, onChange }: { item: EditableLesson, onChange: (id: string, field: keyof EditableLesson, value: any) => void }) {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={item}
            id={item.id}
            dragListener={false}
            dragControls={dragControls}
            style={rowStyle}
        >
            {/* Drag Handle */}
            <div
                style={{ ...cellStyle, cursor: 'grab', minHeight: '100%', alignItems: 'center', paddingTop: '0.8rem', color: '#64748b' }}
                onPointerDown={(e) => dragControls.start(e)}
            >
                <GripVertical size={20} />
            </div>

            {/* Title */}
            <div style={cellStyle}>
                <textarea
                    value={item.title}
                    onChange={(e) => onChange(item.id, 'title', e.target.value)}
                    style={textareaStyle}
                    placeholder="Judul Lesson"
                    rows={1}
                />
            </div>

            {/* Sessions */}
            <div style={cellStyle}>
                <input
                    type="number"
                    min="0"
                    value={item.estimated_meeting_count || ''}
                    onChange={(e) => onChange(item.id, 'estimated_meeting_count', parseInt(e.target.value) || 0)}
                    style={{ ...inputStyle, textAlign: 'center', height: 'auto', alignSelf: 'flex-start' }}
                />
            </div>

            {/* Summary */}
            <div style={cellStyle}>
                <textarea
                    value={item.summary}
                    onChange={(e) => onChange(item.id, 'summary', e.target.value)}
                    style={textareaStyle}
                    placeholder="Ringkasan materi..."
                // rows={3} // removed fixed rows
                />
            </div>

            {/* Slide URL */}
            <div style={{ ...cellStyle, position: 'relative' }}>
                <textarea
                    value={item.slide_url}
                    onChange={(e) => onChange(item.id, 'slide_url', e.target.value)}
                    style={{ ...textareaStyle, paddingRight: '2rem', wordBreak: 'break-all' }} // Word break for URL
                    placeholder="https://..."
                    rows={1}
                />
                {item.slide_url && (
                    <a
                        href={item.slide_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ position: 'absolute', right: '10px', top: '12px', color: '#3b82f6', zIndex: 10 }}
                        title="Open Slide"
                    >
                        <ExternalLink size={14} />
                    </a>
                )}
            </div>

            {/* Makeup Instructions */}
            <div style={cellStyle}>
                <textarea
                    value={item.make_up_instructions}
                    onChange={(e) => onChange(item.id, 'make_up_instructions', e.target.value)}
                    style={textareaStyle}
                    placeholder="Instruksi tugas susulan..."
                // rows={3} // removed fixed rows
                />
            </div>

            {/* Actions */}
            <div style={{ ...cellStyle, alignItems: 'center', paddingTop: '0.8rem', borderRight: 'none' }}>
                <DeleteLessonButton lessonId={item.id} lessonTitle={item.title} iconOnly />
            </div>

        </Reorder.Item>
    );
}

// Grid Column Definition
const gridTemplate = '50px 1.5fr 80px 2fr 1.5fr 1.5fr 60px'; // Fixed widths for small cols, fr for flexible content

// Styles
const tableContainerStyle: CSSProperties = {
    border: '1px solid #94a3b8',
    borderRadius: '0.75rem',
    background: '#fff',
    overflow: 'hidden', // Contains layout
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    minWidth: '1000px', // Ensure it doesn't too small on small screens causing breaks
};

const headerRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridTemplate,
    borderBottom: '1px solid #94a3b8',
    background: '#e2e8f0',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    alignItems: 'stretch', // Full height borders
};

const headerCellStyle: CSSProperties = {
    padding: '0.8rem',
    borderRight: '1px solid #94a3b8',
    textAlign: 'left',
    display: 'flex', // Enable flex for vertical center
    alignItems: 'center', // Vertically center text
    height: '100%', // Fill the grid cell
    fontWeight: 700,
};

const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridTemplate,
    borderBottom: '1px solid #94a3b8',
    background: '#fff',
    minHeight: '60px',
    alignItems: 'stretch',
};

const cellStyle: CSSProperties = {
    padding: '0',
    borderRight: '1px solid #94a3b8', // Darker border
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch', // changed from implicit to stretch for content, but we want input to stretch. 
    position: 'relative',
};

const inputStyle: CSSProperties = {
    width: '100%',
    height: '100%', // Fill cell
    paddingTop: '0.8rem',
    paddingBottom: '0.8rem',
    paddingLeft: '0.8rem',
    paddingRight: '0.8rem',
    borderRadius: '0', // No rounded corners for cell look
    border: 'none', // Remove individual border
    background: 'transparent',
    fontSize: '0.9rem',
    color: '#0f172a',
    outline: 'none',
    transition: 'background 0.15s',
};

// Add hover/focus styles via class/global if possible, but inline:
// We can simulate focus by making border visible on focus? Hard with inline.
// Strategy: Keep it clean, maybe light gray border on hover.

const textareaStyle: CSSProperties = {
    ...inputStyle,
    resize: 'none', // Auto-grow handles height
    minHeight: '60px',
    fontFamily: 'inherit',
    lineHeight: '1.5',
    overflow: 'hidden', // Hide scrollbar if auto-resize works, or show if static
    whiteSpace: 'pre-wrap',
    fieldSizing: 'content', // Modern CSS for auto-sizing, fallback needed for older browsers (polyfill/script)
    height: 'auto', // Allow grow
    display: 'block',
    // lineHeight: '1.6', // Removed duplicate
};

const floatingBarStyle: CSSProperties = {
    position: 'fixed',
    bottom: '2rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e293b',
    color: '#fff',
    padding: '0.75rem 1.5rem',
    borderRadius: '2rem',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
    zIndex: 10000, // Ensure strictly above fullscreen container (9999)
    fontSize: '0.9rem',
};

const saveButtonStyle: CSSProperties = {
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '1.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
};

const cancelButtonStyle: CSSProperties = {
    background: 'transparent',
    color: '#94a3b8',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
};

const emptyStyle: CSSProperties = {
    padding: '3rem',
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
};

const fullscreenContainerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f1f5f9',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
};

const topBarStyle: CSSProperties = {
    background: '#fff',
    padding: '1rem 2rem',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
};

const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: '1px solid #cbd5e1',
    borderRadius: '0.375rem',
    padding: '0.4rem 0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    color: '#475569',
    fontWeight: 500,
    transition: 'all 0.2s',
};
