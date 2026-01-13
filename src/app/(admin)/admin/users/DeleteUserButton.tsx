'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteUserButton({ userId }: { userId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleOpenModal = () => {
        setOpen(true);
        setErrorMessage(null);
    };

    const handleCancel = () => {
        setOpen(false);
    };

    const handleConfirmDelete = () => {
        startTransition(async () => {
            try {
                const res = await fetch(`/api/admin/users/${userId}`, {
                    method: 'DELETE',
                });

                if (!res.ok) {
                    const data = await res.json();
                    setErrorMessage(data.error || 'Gagal menghapus user');
                    return;
                }

                setOpen(false);
                router.refresh();
            } catch (err) {
                console.error(err);
                setErrorMessage('Terjadi kesalahan saat menghapus user');
            }
        });
    };

    return (
        <>
            <button
                onClick={handleOpenModal}
                disabled={isPending}
                style={buttonStyle}
            >
                Hapus
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleCancel}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Konfirmasi Hapus</h3>
                        <p style={bodyStyle}>Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.</p>

                        {errorMessage && (
                            <p style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem' }}>{errorMessage}</p>
                        )}

                        <div style={actionsStyle}>
                            <button
                                type="button"
                                onClick={handleCancel}
                                style={cancelButtonStyle}
                                disabled={isPending}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                style={confirmButtonStyle}
                                disabled={isPending}
                            >
                                {isPending ? 'Menghapus...' : 'Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Styles
const buttonStyle: CSSProperties = {
    padding: '0.35rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #ef4444',
    background: '#fee2e2',
    color: '#b91c1c',
    fontSize: '0.85rem',
    cursor: 'pointer',
};

const backdropStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '1.5rem',
};

const modalStyle: CSSProperties = {
    background: '#ffffff',
    padding: '1.5rem',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
};

const titleStyle: CSSProperties = {
    margin: '0 0 0.5rem 0',
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#0f172a',
};

const bodyStyle: CSSProperties = {
    margin: '0 0 1.5rem 0',
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: 1.5,
};

const actionsStyle: CSSProperties = {
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
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const confirmButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#ef4444',
    color: '#ffffff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: '80px',
};
