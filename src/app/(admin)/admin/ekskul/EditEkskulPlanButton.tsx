'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Edit, Trash2 } from 'lucide-react';
import EkskulSoftwareSelector from './EkskulSoftwareSelector';

type Props = {
    plan: {
        id: string;
        name: string;
        description: string | null;
        is_active: boolean;
        ekskul_plan_software?: { software: { id: string; name: string } }[];
    };
    // No softwareList, component fetches its own data
};

export default function EditEkskulPlanButton({ plan }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState(plan.name);
    const [description, setDescription] = useState(plan.description || '');
    const [isActive, setIsActive] = useState(plan.is_active);
    // Extract initial software IDs
    const initialSoftwareIds = plan.ekskul_plan_software?.map(item => item.software.id) || [];
    const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<string[]>(initialSoftwareIds);

    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleClose = () => {
        setOpen(false);
        setConfirmDelete(false);
        setError(null);
    };

    const handleUpdate = () => {
        if (!name.trim()) {
            setError('Nama wajib diisi');
            return;
        }
        if (selectedSoftwareIds.length === 0) {
            setError('Pilih minimal satu software');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/ekskul/plans/${plan.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        description: description.trim() || null,
                        softwareIds: selectedSoftwareIds,
                        is_active: isActive,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal update plan');
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

    const handleDelete = () => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/ekskul/plans/${plan.id}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal menghapus plan');
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
            <button onClick={() => setOpen(true)} style={editBtnStyle}>
                <Edit size={14} /> Edit
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <h3 style={titleStyle}>Edit Lesson Plan</h3>
                            {confirmDelete ? (
                                <button onClick={() => setConfirmDelete(false)} style={cancelDeleteStyle}>Batal Hapus</button>
                            ) : (
                                <button onClick={() => setConfirmDelete(true)} style={deleteBtnStyle}>
                                    <Trash2 size={16} /> Hapus Plan
                                </button>
                            )}
                        </div>

                        {confirmDelete ? (
                            <div style={confirmDeleteBox}>
                                <p style={{ fontWeight: 600, color: '#991b1b', marginBottom: '0.5rem' }}>Yakin hapus plan ini?</p>
                                <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Semua lesson di dalamnya juga akan terhapus permanen.</p>
                                <button onClick={handleDelete} style={confirmDeleteBtn} disabled={isPending}>
                                    {isPending ? 'Menghapus...' : 'Ya, Hapus Sekarang'}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Nama Plan *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>

                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Status</label>
                                    <select
                                        value={isActive ? 'true' : 'false'}
                                        onChange={(e) => setIsActive(e.target.value === 'true')}
                                        style={inputStyle}
                                    >
                                        <option value="true">Aktif</option>
                                        <option value="false">Nonaktif (Arsip)</option>
                                    </select>
                                </div>

                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Software Wajib (Minimal 1) *</label>
                                    <EkskulSoftwareSelector
                                        selectedIds={selectedSoftwareIds}
                                        onChange={setSelectedSoftwareIds}
                                    />
                                </div>

                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Deskripsi</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </div>

                                {error && <p style={errorStyle}>{error}</p>}

                                <div style={actionsStyle}>
                                    <button onClick={handleClose} style={cancelStyle} disabled={isPending}>
                                        Batal
                                    </button>
                                    <button onClick={handleUpdate} style={submitStyle} disabled={isPending}>
                                        {isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

const editBtnStyle: CSSProperties = {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    transition: 'all 0.2s'
};

const deleteBtnStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.85rem',
    fontWeight: 600,
};

const cancelDeleteStyle: CSSProperties = {
    background: '#f1f5f9',
    border: 'none',
    padding: '0.3rem 0.8rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    color: '#64748b',
    cursor: 'pointer',
};

const confirmDeleteBox: CSSProperties = {
    background: '#fee2e2',
    padding: '1rem',
    borderRadius: '0.75rem',
    border: '1px solid #fecaca',
    textAlign: 'center',
};

const confirmDeleteBtn: CSSProperties = {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
};

// Reused styles
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
    maxWidth: '500px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
};

const titleStyle: CSSProperties = {
    margin: 0,
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
