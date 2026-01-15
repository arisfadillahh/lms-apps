'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Edit2, Trash2 } from 'lucide-react';

type Level = {
    id: string;
    name: string;
};

type Pricing = {
    id: string;
    level_id: string;
    mode: 'ONLINE' | 'OFFLINE';
    base_price_monthly: number;
    is_active: boolean;
};

type Props = {
    pricing: Pricing;
    levels: Level[];
    levelName: string;
};

export default function PricingActions({ pricing, levels, levelName }: Props) {
    const router = useRouter();
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [levelId, setLevelId] = useState(pricing.level_id);
    const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>(pricing.mode);
    const [price, setPrice] = useState(String(pricing.base_price_monthly));
    const [isActive, setIsActive] = useState(pricing.is_active);
    const [error, setError] = useState<string | null>(null);

    const handleEditOpen = () => {
        setLevelId(pricing.level_id);
        setMode(pricing.mode);
        setPrice(String(pricing.base_price_monthly));
        setIsActive(pricing.is_active);
        setError(null);
        setEditOpen(true);
    };

    const handleEditClose = () => {
        setEditOpen(false);
        setError(null);
    };

    const handleEdit = () => {
        if (!levelId) {
            setError('Pilih level');
            return;
        }
        if (!price || Number(price) <= 0) {
            setError('Harga harus lebih dari 0');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch('/api/admin/payments/pricing', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: pricing.id,
                        levelId,
                        mode,
                        basePriceMonthly: Number(price),
                        isActive,
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal mengupdate harga');
                    return;
                }

                handleEditClose();
                router.refresh();
            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan');
            }
        });
    };

    const handleDelete = () => {
        setError(null);
        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/payments/pricing?id=${pricing.id}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal menghapus harga');
                    return;
                }

                setDeleteOpen(false);
                router.refresh();
            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleEditOpen} style={editBtnStyle} title="Edit Harga">
                    <Edit2 size={14} />
                </button>
                <button onClick={() => setDeleteOpen(true)} style={deleteBtnStyle} title="Hapus Harga">
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Edit Modal */}
            {editOpen && (
                <div style={backdropStyle} onClick={handleEditClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Edit Harga Level</h3>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Level *</label>
                            <select value={levelId} onChange={(e) => setLevelId(e.target.value)} style={inputStyle}>
                                <option value="">-- Pilih Level --</option>
                                {levels.map((level) => (
                                    <option key={level.id} value={level.id}>{level.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Mode *</label>
                            <select value={mode} onChange={(e) => setMode(e.target.value as 'ONLINE' | 'OFFLINE')} style={inputStyle}>
                                <option value="ONLINE">Online</option>
                                <option value="OFFLINE">Offline</option>
                            </select>
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Harga per Bulan (Rp) *</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="500000"
                                min={0}
                                style={inputStyle}
                            />
                        </div>

                        <div style={fieldStyle}>
                            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                />
                                Harga Aktif
                            </label>
                        </div>

                        {error && <p style={errorStyle}>{error}</p>}

                        <div style={actionsStyle}>
                            <button onClick={handleEditClose} style={cancelStyle} disabled={isPending}>
                                Batal
                            </button>
                            <button onClick={handleEdit} style={submitStyle} disabled={isPending}>
                                {isPending ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {deleteOpen && (
                <div style={backdropStyle} onClick={() => setDeleteOpen(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Hapus Harga</h3>
                        <p style={descStyle}>
                            Apakah Anda yakin ingin menghapus harga untuk <strong>{levelName}</strong> ({pricing.mode})?
                        </p>

                        {error && <p style={errorStyle}>{error}</p>}

                        <div style={actionsStyle}>
                            <button onClick={() => setDeleteOpen(false)} style={cancelStyle} disabled={isPending}>
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

const descStyle: CSSProperties = {
    fontSize: '0.9rem',
    color: '#475569',
    marginBottom: '1rem',
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
};
