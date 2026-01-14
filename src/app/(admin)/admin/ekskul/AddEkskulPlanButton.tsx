'use client';

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import EkskulSoftwareSelector from './EkskulSoftwareSelector';

type Props = {};

export default function AddEkskulPlanButton({ }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setOpen(false);
        setName('');
        setDescription('');
        setSelectedSoftwareIds([]);
        setError(null);
    };

    const handleSubmit = () => {
        if (!name.trim()) {
            setError('Nama plan wajib diisi');
            return;
        }
        if (selectedSoftwareIds.length === 0) {
            setError('Pilih minimal satu software');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch('/api/admin/ekskul/plans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        description: description.trim() || null,
                        softwareIds: selectedSoftwareIds,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal membuat plan');
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
            <button onClick={() => setOpen(true)} style={triggerStyle}>
                + Tambah Plan
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Tambah Lesson Plan Ekskul</h3>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Nama Plan *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Contoh: Scratch Dasar - Semester 1"
                                style={inputStyle}
                                autoFocus
                            />
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Deskripsi (opsional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Deskripsi singkat tentang lesson plan ini..."
                                rows={2}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Software Wajib (Minimal 1) *</label>
                            <EkskulSoftwareSelector
                                selectedIds={selectedSoftwareIds}
                                onChange={setSelectedSoftwareIds}
                            />
                        </div>

                        {error && <p style={errorStyle}>{error}</p>}

                        <div style={actionsStyle}>
                            <button onClick={handleClose} style={cancelStyle} disabled={isPending}>
                                Batal
                            </button>
                            <button onClick={handleSubmit} style={submitStyle} disabled={isPending}>
                                {isPending ? 'Menyimpan...' : 'Simpan Plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const triggerStyle: CSSProperties = {
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
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
    maxWidth: '520px',
    maxHeight: '90vh',
    overflow: 'auto',
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
    background: '#2563eb',
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
