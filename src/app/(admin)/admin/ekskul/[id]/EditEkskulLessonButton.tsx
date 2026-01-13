'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
    lesson: {
        id: string;
        title: string;
        summary: string | null;
        slide_url: string | null;
        estimated_meetings: number;
        order_index: number;
    };
    planId: string;
};

export default function EditEkskulLessonButton({ lesson, planId }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [title, setTitle] = useState(lesson.title);
    const [summary, setSummary] = useState(lesson.summary || '');
    const [slideUrl, setSlideUrl] = useState(lesson.slide_url || '');
    const [estimatedMeetings, setEstimatedMeetings] = useState(String(lesson.estimated_meetings || 1));
    const [orderIndex, setOrderIndex] = useState(String(lesson.order_index));
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setOpen(false);
        setError(null);
    };

    const handleSubmit = () => {
        if (!title.trim()) {
            setError('Judul wajib diisi');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/ekskul/lessons/${lesson.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        planId,
                        title: title.trim(),
                        summary: summary.trim() || null,
                        slideUrl: slideUrl.trim() || null,
                        estimatedMeetings: Number(estimatedMeetings),
                        orderIndex: Number(orderIndex),
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal mengupdate lesson');
                    return;
                }

                handleClose();
                router.refresh();
            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            <button onClick={() => setOpen(true)} style={editButtonStyle}>
                Edit
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Edit Lesson</h3>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Judul Lesson *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={inputStyle}
                                autoFocus
                            />
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Ringkasan</label>
                            <textarea
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                rows={2}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Link Slide</label>
                            <input
                                type="url"
                                value={slideUrl}
                                onChange={(e) => setSlideUrl(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{ ...fieldStyle, flex: 1 }}>
                                <label style={labelStyle}>Jumlah Pertemuan</label>
                                <input
                                    type="number"
                                    value={estimatedMeetings}
                                    onChange={(e) => setEstimatedMeetings(e.target.value)}
                                    min={1}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ ...fieldStyle, flex: 1 }}>
                                <label style={labelStyle}>Urutan</label>
                                <input
                                    type="number"
                                    value={orderIndex}
                                    onChange={(e) => setOrderIndex(e.target.value)}
                                    min={1}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {error && <p style={errorStyle}>{error}</p>}

                        <div style={actionsStyle}>
                            <button onClick={handleClose} style={cancelStyle} disabled={isPending}>
                                Batal
                            </button>
                            <button onClick={handleSubmit} style={submitStyle} disabled={isPending}>
                                {isPending ? 'Simpan' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const editButtonStyle: CSSProperties = {
    padding: '0.4rem 0.8rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#0f172a',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
};

const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
};

const modalStyle: CSSProperties = {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
};

const titleStyle: CSSProperties = {
    margin: '0 0 1.25rem 0',
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#0f172a',
};

const fieldStyle: CSSProperties = {
    marginBottom: '1rem',
};

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#334155',
    marginBottom: '0.35rem',
};

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    color: '#0f172a',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.25rem',
};

const cancelStyle: CSSProperties = {
    padding: '0.55rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const submitStyle: CSSProperties = {
    padding: '0.55rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#7c3aed',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const errorStyle: CSSProperties = {
    color: '#dc2626',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
};
