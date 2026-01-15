'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2 } from 'lucide-react';

type Props = {
    user: {
        id: string;
        full_name: string;
        parent_contact_phone: string | null;
        role: 'ADMIN' | 'COACH' | 'CODER';
    };
};

export default function EditUserButton({ user }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [fullName, setFullName] = useState(user.full_name);
    const [parentContact, setParentContact] = useState(user.parent_contact_phone || '');
    const [error, setError] = useState<string | null>(null);

    const handleOpen = () => {
        setFullName(user.full_name);
        setParentContact(user.parent_contact_phone || '');
        setError(null);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setError(null);
    };

    const handleSubmit = () => {
        if (!fullName.trim()) {
            setError('Nama lengkap wajib diisi');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch('/api/admin/users/update', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: user.id,
                        fullName: fullName.trim(),
                        parentContactPhone: user.role === 'CODER' ? parentContact.trim() || null : null,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal mengupdate user');
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
            <button onClick={handleOpen} style={editBtnStyle} title="Edit User">
                <Edit2 size={14} />
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Edit User</h3>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Username</label>
                            <input
                                type="text"
                                value={user.id.slice(0, 8) + '...'}
                                disabled
                                style={{ ...inputStyle, background: '#f1f5f9', color: '#64748b' }}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                Username tidak bisa diubah
                            </p>
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Nama Lengkap *</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Nama lengkap"
                                style={inputStyle}
                                autoFocus
                            />
                        </div>

                        {user.role === 'CODER' && (
                            <div style={fieldStyle}>
                                <label style={labelStyle}>Kontak Orang Tua (WhatsApp)</label>
                                <input
                                    type="tel"
                                    value={parentContact}
                                    onChange={(e) => setParentContact(e.target.value)}
                                    placeholder="08123456789"
                                    style={inputStyle}
                                />
                            </div>
                        )}

                        <div style={{ ...fieldStyle, background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Role: {user.role}</label>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                Role tidak bisa diubah dari sini
                            </p>
                        </div>

                        {error && <p style={errorStyle}>{error}</p>}

                        <div style={actionsStyle}>
                            <button onClick={handleClose} style={cancelStyle} disabled={isPending}>
                                Batal
                            </button>
                            <button onClick={handleSubmit} style={submitStyle} disabled={isPending}>
                                {isPending ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const editBtnStyle: CSSProperties = {
    padding: '0.35rem',
    borderRadius: '0.375rem',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
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
    maxWidth: '420px',
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
    background: '#1e3a5f',
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
