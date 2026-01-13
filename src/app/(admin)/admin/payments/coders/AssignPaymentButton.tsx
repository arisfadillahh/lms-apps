'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type PaymentPlan = {
    id: string;
    name: string;
    duration_months: number;
    discount_percent: number;
};

type Pricing = {
    id: string;
    level_id: string;
    mode: 'ONLINE' | 'OFFLINE';
    base_price_monthly: number;
    levels?: any; // Supabase join returns object or array
};

type Props = {
    coderId: string;
    coderName: string;
    plans: PaymentPlan[];
    pricing: Pricing[];
};

export default function AssignPaymentButton({ coderId, coderName, plans, pricing }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [planId, setPlanId] = useState('');
    const [pricingId, setPricingId] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState<string | null>(null);

    // Calculate end date and total
    const selectedPlan = plans.find((p) => p.id === planId);
    const selectedPricing = pricing.find((p) => p.id === pricingId);

    const calculateTotal = () => {
        if (!selectedPlan || !selectedPricing) return 0;
        const baseTotal = selectedPricing.base_price_monthly * selectedPlan.duration_months;
        const discount = (baseTotal * selectedPlan.discount_percent) / 100;
        return baseTotal - discount;
    };

    const calculateEndDate = () => {
        if (!selectedPlan || !startDate) return '';
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + selectedPlan.duration_months);
        return date.toISOString().split('T')[0];
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    };

    const handleClose = () => {
        setOpen(false);
        setPlanId('');
        setPricingId('');
        setStartDate(new Date().toISOString().split('T')[0]);
        setError(null);
    };

    const handleSubmit = () => {
        if (!planId) { setError('Pilih paket'); return; }
        if (!pricingId) { setError('Pilih level harga'); return; }
        if (!startDate) { setError('Pilih tanggal mulai'); return; }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch('/api/admin/payments/periods', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        coderId,
                        paymentPlanId: planId,
                        pricingId,
                        startDate,
                        endDate: calculateEndDate(),
                        totalAmount: calculateTotal(),
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal menyimpan');
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
                + Assign
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Assign Periode Belajar</h3>
                        <p style={subtitleStyle}>Untuk: <strong>{coderName}</strong></p>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Paket Pembayaran *</label>
                            <select value={planId} onChange={(e) => setPlanId(e.target.value)} style={inputStyle}>
                                <option value="">-- Pilih Paket --</option>
                                {plans.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.name} ({plan.duration_months} bulan) - Diskon {plan.discount_percent}%
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Level & Mode *</label>
                            <select value={pricingId} onChange={(e) => setPricingId(e.target.value)} style={inputStyle}>
                                <option value="">-- Pilih Level --</option>
                                {pricing.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.levels?.name || 'Unknown'} - {p.mode} ({formatCurrency(p.base_price_monthly)}/bln)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={fieldStyle}>
                            <label style={labelStyle}>Tanggal Mulai *</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        {selectedPlan && selectedPricing && (
                            <div style={summaryStyle}>
                                <div style={summaryRowStyle}>
                                    <span>Berakhir:</span>
                                    <span>{calculateEndDate()}</span>
                                </div>
                                <div style={summaryRowStyle}>
                                    <span>Total:</span>
                                    <strong>{formatCurrency(calculateTotal())}</strong>
                                </div>
                            </div>
                        )}

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
    padding: '0.4rem 0.8rem',
    borderRadius: '0.375rem',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: '0.8rem',
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
    maxWidth: '480px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
};

const titleStyle: CSSProperties = {
    margin: '0 0 0.25rem 0',
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#0f172a',
};

const subtitleStyle: CSSProperties = {
    fontSize: '0.9rem',
    color: '#64748b',
    marginBottom: '1.25rem',
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

const summaryStyle: CSSProperties = {
    background: '#f0fdf4',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
};

const summaryRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    marginBottom: '0.25rem',
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
