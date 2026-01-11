"use client";

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Trash2, AlertTriangle, X } from 'lucide-react';

type DeleteLessonButtonProps = {
    lessonId: string;
    lessonTitle: string;
};

export default function DeleteLessonButton({ lessonId, lessonTitle }: DeleteLessonButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    const handleDelete = () => {
        startTransition(async () => {
            setError(null);
            const response = await fetch(`/api/admin/curriculum/lessons/${lessonId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                setError(payload.error ?? 'Gagal menghapus lesson');
                return;
            }

            setOpen(false);
            router.refresh();
        });
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Trigger asChild>
                    <button type="button" style={deleteTriggerStyle} title="Hapus Lesson">
                        <Trash2 size={15} />
                    </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                    <Dialog.Overlay style={overlayStyle} />
                    <Dialog.Content style={contentStyle}>
                        <div style={headerStyle}>
                            <div style={iconContainerStyle}>
                                <AlertTriangle size={24} color="#dc2626" />
                            </div>
                            <Dialog.Title style={titleStyle}>Hapus Lesson?</Dialog.Title>
                            <Dialog.Close asChild>
                                <button style={closeButtonStyle} aria-label="Close">
                                    <X size={18} />
                                </button>
                            </Dialog.Close>
                        </div>

                        <Dialog.Description style={descriptionStyle}>
                            Anda akan menghapus lesson <strong>"{lessonTitle}"</strong>.
                            Tindakan ini tidak dapat dibatalkan.
                        </Dialog.Description>

                        {error ? <div style={errorStyle}>{error}</div> : null}

                        <div style={buttonContainerStyle}>
                            <Dialog.Close asChild>
                                <button type="button" style={cancelButtonStyle} disabled={isPending}>
                                    Batal
                                </button>
                            </Dialog.Close>
                            <button type="button" onClick={handleDelete} style={confirmDeleteButtonStyle} disabled={isPending}>
                                {isPending ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}

const deleteTriggerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.4rem',
    borderRadius: '0.5rem',
    border: '1px solid #fee2e2',
    background: '#fff1f2',
    color: '#dc2626',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(2px)',
    zIndex: 999,
};

const contentStyle: CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#ffffff',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    zIndex: 1000,
};

const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
};

const iconContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(220, 38, 38, 0.1)',
};

const titleStyle: CSSProperties = {
    flex: 1,
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
};

const closeButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.35rem',
    border: 'none',
    borderRadius: '0.35rem',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
};

const descriptionStyle: CSSProperties = {
    fontSize: '0.9rem',
    color: '#475569',
    lineHeight: 1.6,
    marginBottom: '1.25rem',
};

const errorStyle: CSSProperties = {
    padding: '0.65rem 0.85rem',
    borderRadius: '0.5rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '0.85rem',
    marginBottom: '1rem',
};

const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
};

const cancelButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#475569',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.9rem',
};

const confirmDeleteButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#dc2626',
    color: '#ffffff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
};
