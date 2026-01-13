'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

type Props = {
    lessonId: string;
    lessonTitle: string;
    planId: string;
};

export default function DeleteLessonButton({ lessonId, lessonTitle, planId }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/ekskul/lessons/${lessonId}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    alert(data.error || 'Gagal menghapus lesson');
                    return;
                }

                setOpen(false);
                router.refresh();
            } catch (err) {
                console.error(err);
                alert('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            <button onClick={() => setOpen(true)} style={triggerStyle} title="Hapus Lesson">
                <Trash2 size={16} />
            </button>

            {open && (
                <div style={backdropStyle} onClick={() => setOpen(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Hapus Lesson?</h3>
                        <p style={descStyle}>
                            Yakin ingin menghapus lesson <strong>"{lessonTitle}"</strong>?
                        </p>

                        <div style={actionsStyle}>
                            <button onClick={() => setOpen(false)} style={cancelStyle} disabled={isPending}>
                                Batal
                            </button>
                            <button onClick={handleDelete} style={deleteStyle} disabled={isPending}>
                                {isPending ? 'Menghapus...' : 'Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const triggerStyle: CSSProperties = {
    padding: '0.4rem',
    borderRadius: '0.375rem',
    border: 'none',
    background: '#fee2e2',
    color: '#dc2626',
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
    maxWidth: '400px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
};

const titleStyle: CSSProperties = {
    margin: '0 0 0.5rem 0',
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#0f172a',
};

const descStyle: CSSProperties = {
    color: '#64748b',
    fontSize: '0.9rem',
    marginBottom: '1.25rem',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
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

const deleteStyle: CSSProperties = {
    padding: '0.55rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};
