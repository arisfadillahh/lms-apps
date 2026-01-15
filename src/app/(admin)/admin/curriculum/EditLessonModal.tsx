'use client';

import { useState, useTransition, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Save } from 'lucide-react';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import LessonExampleUploader from '@/components/admin/LessonExampleUploader';

type EditLessonModalProps = {
    lesson: LessonTemplateRecord;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function EditLessonModal({ lesson, open, onOpenChange }: EditLessonModalProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Form states
    const [title, setTitle] = useState(lesson.title);
    const [summary, setSummary] = useState(lesson.summary ?? '');
    const [orderIndex, setOrderIndex] = useState(String(lesson.order_index + 1)); // Display 1-based
    const [estimatedMeetingCount, setEstimatedMeetingCount] = useState(
        lesson.estimated_meeting_count !== null ? String(lesson.estimated_meeting_count) : '',
    );
    const [slideUrl, setSlideUrl] = useState(lesson.slide_url ?? '');
    const [makeUpInstructions, setMakeUpInstructions] = useState(lesson.make_up_instructions ?? '');

    const [message, setMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Sync state when lesson changes (if modal is reused)
    useEffect(() => {
        if (open) {
            setTitle(lesson.title);
            setSummary(lesson.summary ?? '');
            setOrderIndex(String(lesson.order_index + 1)); // Display 1-based
            setEstimatedMeetingCount(lesson.estimated_meeting_count !== null ? String(lesson.estimated_meeting_count) : '');
            setSlideUrl(lesson.slide_url ?? '');
            setMakeUpInstructions(lesson.make_up_instructions ?? '');
            setMessage(null);
            setErrorMessage(null);
        }
    }, [open, lesson]);

    const handleSave = () => {
        setMessage(null);
        setErrorMessage(null);

        const payload: Record<string, unknown> = {};

        if (title !== lesson.title) payload.title = title;
        if (summary.trim() !== (lesson.summary ?? '')) payload.summary = summary.trim() || undefined;
        if (slideUrl.trim() !== (lesson.slide_url ?? '')) payload.slideUrl = slideUrl.trim() || undefined;

        const orderValue = Number(orderIndex);
        // Convert 1-based visual back to 0-based for DB
        const dbOrderIndex = orderValue - 1;

        if (!Number.isNaN(orderValue) && dbOrderIndex !== lesson.order_index) {
            payload.orderIndex = dbOrderIndex;
        }

        const nextSessions = estimatedMeetingCount.trim() === '' ? null : Number(estimatedMeetingCount);
        if (nextSessions !== lesson.estimated_meeting_count) {
            payload.estimatedMeetingCount = nextSessions;
        }

        if (makeUpInstructions.trim() !== (lesson.make_up_instructions ?? '')) {
            payload.makeUpInstructions = makeUpInstructions.trim() || undefined;
        }

        if (Object.keys(payload).length === 0) {
            setMessage('Tidak ada perubahan');
            setTimeout(() => setMessage(null), 2000);
            return;
        }

        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/curriculum/lessons/${lesson.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setErrorMessage(data.error ?? 'Gagal memperbarui lesson');
                    return;
                }

                setMessage('Lesson diperbarui');
                router.refresh();
                setTimeout(() => {
                    onOpenChange(false);
                    setMessage(null);
                }, 1000);
            } catch (error) {
                console.error('Update lesson error', error);
                setErrorMessage('Terjadi kesalahan');
            }
        });
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay style={overlayStyle} />
                <Dialog.Content style={contentStyle}>
                    <div style={headerStyle}>
                        <Dialog.Title style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>
                            Edit Lesson
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button style={closeButtonStyle} aria-label="Close">
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div style={bodyStyle}>
                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Judul Lesson</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={inputStyle}
                                placeholder="Ex: Intro to Python"
                            />
                        </div>

                        <div style={rowGroupStyle}>
                            <div style={fieldGroupStyle}>
                                <label style={labelStyle}>Urutan</label>
                                <input
                                    type="number"
                                    value={orderIndex}
                                    onChange={(e) => setOrderIndex(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={fieldGroupStyle}>
                                <label style={labelStyle}>Jumlah Pertemuan (Sesi)</label>
                                <input
                                    type="number"
                                    value={estimatedMeetingCount}
                                    onChange={(e) => setEstimatedMeetingCount(e.target.value)}
                                    style={inputStyle}
                                    min={0}
                                />
                            </div>
                        </div>

                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Ringkasan</label>
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={3}
                                style={textareaStyle}
                            />
                        </div>

                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>URL Slide</label>
                            <input
                                type="url"
                                value={slideUrl}
                                onChange={(e) => setSlideUrl(e.target.value)}
                                style={inputStyle}
                                placeholder="https://docs.google.com/presentation/..."
                            />
                        </div>

                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Instruksi Make-Up</label>
                            <textarea
                                value={makeUpInstructions}
                                onChange={(e) => setMakeUpInstructions(e.target.value)}
                                rows={3}
                                style={textareaStyle}
                                placeholder="Instruksi untuk coder yang tidak hadir..."
                            />
                        </div>

                        <div style={{ marginTop: '0.5rem' }}>
                            <LessonExampleUploader
                                endpoint={`/api/admin/curriculum/lessons/${lesson.id}/example`}
                                currentUrl={lesson.example_url}
                                label="Contoh Game (Template)"
                                emptyHint="Belum ada contoh game."
                                uploadSuccessMessage="Contoh game berhasil diupload"
                                deleteSuccessMessage="Contoh game dihapus"
                            />
                        </div>
                    </div>

                    <div style={footerStyle}>
                        {errorMessage ? <span style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errorMessage}</span> : null}
                        {message ? <span style={{ color: '#15803d', fontSize: '0.85rem' }}>{message}</span> : null}
                        <div style={{ flex: 1 }} />
                        <Dialog.Close asChild>
                            <button style={cancelButtonStyle} disabled={isPending}>Batal</button>
                        </Dialog.Close>
                        <button onClick={handleSave} style={primaryButtonStyle} disabled={isPending}>
                            {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

// Styles
const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
    backdropFilter: 'blur(2px)',
};

const contentStyle: CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#ffffff',
    borderRadius: '1rem',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '1rem',
    marginBottom: '-0.5rem',
};

const bodyStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
};

const footerStyle: CSSProperties = {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'center',
    paddingTop: '1rem',
    borderTop: '1px solid #e2e8f0',
    marginTop: '0.5rem',
};

const rowGroupStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
};

const fieldGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    flex: 1,
};

const labelStyle: CSSProperties = {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#334155', // Slate-700
};

const inputStyle: CSSProperties = {
    padding: '0.6rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1', // Slate-300
    fontSize: '0.9rem',
    color: '#0f172a', // Slate-900
    background: '#ffffff',
    width: '100%',
};

const textareaStyle: CSSProperties = {
    ...inputStyle,
    resize: 'vertical',
    minHeight: '80px',
};

const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const primaryButtonStyle: CSSProperties = {
    padding: '0.6rem 1.25rem',
    borderRadius: '0.5rem',
    background: '#1e3a5f',
    color: '#ffffff',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
};

const cancelButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    background: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    cursor: 'pointer',
    fontWeight: 500,
    fontSize: '0.9rem',
};
