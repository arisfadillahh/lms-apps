'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

type Props = {
    planId: string;
    planName: string;
};

export default function DeletePaymentPlanButton({ planId, planName }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleDelete = () => {
        setError(null);
        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/payments/plans?id=${planId}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal menghapus paket');
                    return;
                }

                setOpen(false);
                router.refresh();
            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            <button onClick={() => setOpen(true)} style={deleteBtnStyle} title="Hapus Paket">
                <Trash2 size={14} />
            </button>

            {open && (
                <div style={backdropStyle} onClick={() => setOpen(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Hapus Paket</h3>
                        <p style={descStyle}>
                            Apakah Anda yakin ingin menghapus paket <strong>&quot;{planName}&quot;</strong>?
                        </p>
                        <p style={warningStyle}>
                            ⚠️ Paket yang sudah digunakan oleh siswa tidak dapat dihapus.
                        </p>

                        {error && <p style={errorStyle}>{error}</p>}

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

const deleteBtnStyle: CSSProperties = {
    padding: '0.35rem',
    borderRadius: '0.375rem',
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    margin: '0 0 0.75rem 0',
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#0f172a',
};

const descStyle: CSSProperties = {
    fontSize: '0.9rem',
    color: '#475569',
    marginBottom: '0.5rem',
};

const warningStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#b45309',
    background: '#fef3c7',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1rem',
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

const errorStyle: CSSProperties = {
    color: '#dc2626',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
    marginBottom: '0.5rem',
};
