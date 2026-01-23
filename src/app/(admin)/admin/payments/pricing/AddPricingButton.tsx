'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Level = {
    id: string;
    name: string;
};

export default function AddPricingButton({ levels }: { levels: Level[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [pricingType, setPricingType] = useState<'WEEKLY' | 'SEASONAL'>('WEEKLY');
    const [levelId, setLevelId] = useState('');
    const [seasonalName, setSeasonalName] = useState('');
    const [mode, setMode] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
    const [price, setPrice] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setOpen(false);
        setPricingType('WEEKLY');
        setLevelId('');
        setSeasonalName('');
        setMode('ONLINE');
        setPrice('');
        setError(null);
    };

    const handleSubmit = () => {
        if (pricingType === 'WEEKLY' && !levelId) {
            setError('Pilih level');
            return;
        }
        if (pricingType === 'SEASONAL' && !seasonalName) {
            setError('Isi nama program seasonal');
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
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pricingType,
                        levelId: pricingType === 'WEEKLY' ? levelId : undefined,
                        seasonalName: pricingType === 'SEASONAL' ? seasonalName : undefined,
                        mode,
                        basePriceMonthly: Number(price),
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal menyimpan harga');
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
                + Tambah Harga
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Tambah Harga</h3>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Tipe *</label>
                            <select
                                value={pricingType}
                                onChange={(e) => setPricingType(e.target.value as 'WEEKLY' | 'SEASONAL')}
                                style={inputStyle}
                            >
                                <option value="WEEKLY">Weekly (Regular)</option>
                                <option value="SEASONAL">Seasonal (Special Program)</option>
                            </select>
                        </div>

                        {pricingType === 'WEEKLY' ? (
                            <div style={fieldStyle}>
                                <label style={labelStyle}>Level *</label>
                                <select value={levelId} onChange={(e) => setLevelId(e.target.value)} style={inputStyle}>
                                    <option value="">-- Pilih Level --</option>
                                    {levels.map((level) => (
                                        <option key={level.id} value={level.id}>{level.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div style={fieldStyle}>
                                <label style={labelStyle}>Nama Program Seasonal *</label>
                                <input
                                    type="text"
                                    value={seasonalName}
                                    onChange={(e) => setSeasonalName(e.target.value)}
                                    placeholder="Contoh: Ramadhan Camp 2026"
                                    style={inputStyle}
                                />
                            </div>
                        )}

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

const triggerStyle: CSSProperties = {
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#16a34a',
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
    background: '#16a34a',
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
