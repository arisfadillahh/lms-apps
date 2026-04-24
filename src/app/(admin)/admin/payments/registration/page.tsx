'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { UserPlus, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import PageHead from '@/components/admin/PageHead';

type NewCoder = {
    id: string;
    full_name: string;
    parent_contact_phone: string | null;
    parent_name: string | null;
    created_at: string;
    has_registration_invoice: boolean;
};

type Settings = {
    registration_fee: number;
    registration_fee_discount_percent: number;
};

export default function RegistrationInvoicePage() {
    const [coders, setCoders] = useState<NewCoder[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch coders without registration invoice
            const codersRes = await fetch('/api/admin/payments/registration/coders');
            if (codersRes.ok) {
                const data = await codersRes.json();
                setCoders(data.coders || []);
            }

            // Fetch settings
            const settingsRes = await fetch('/api/admin/settings/invoices');
            if (settingsRes.ok) {
                const data = await settingsRes.json();
                setSettings({
                    registration_fee: data.registration_fee || 0,
                    registration_fee_discount_percent: data.registration_fee_discount_percent || 0
                });
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (coderId: string) => {
        setGenerating(coderId);
        setMessage(null);

        try {
            const res = await fetch('/api/admin/payments/registration/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coderId })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: `Invoice pendaftaran berhasil dibuat: ${data.invoiceNumber}` });
                // Remove from list
                setCoders(prev => prev.filter(c => c.id !== coderId));
            } else {
                setMessage({ type: 'error', text: data.error || 'Gagal generate invoice' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setGenerating(null);
        }
    };

    const handleGenerateAll = async () => {
        const pendingCoders = coders.filter(c => !c.has_registration_invoice && c.parent_contact_phone);
        if (pendingCoders.length === 0) {
            setMessage({ type: 'error', text: 'Tidak ada coder yang bisa digenerate invoice pendaftaran' });
            return;
        }

        setGenerating('all');
        setMessage(null);

        let success = 0;
        let failed = 0;

        for (const coder of pendingCoders) {
            try {
                const res = await fetch('/api/admin/payments/registration/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coderId: coder.id })
                });

                if (res.ok) {
                    success++;
                } else {
                    failed++;
                }
            } catch {
                failed++;
            }
        }

        setMessage({
            type: success > 0 ? 'success' : 'error',
            text: `Generate selesai: ${success} berhasil, ${failed} gagal`
        });

        await fetchData();
        setGenerating(null);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const calculateFinalFee = () => {
        if (!settings) return 0;
        const discount = settings.registration_fee * (settings.registration_fee_discount_percent / 100);
        return settings.registration_fee - discount;
    };

    if (loading) {
        return (
            <div style={loadingStyle}>
                <Loader2 size={24} className="animate-spin" />
                Loading...
            </div>
        );
    }

    return (
        <div className="col gap-4">
            <PageHead
                title="Registrasi Weekly"
                desc="Generate invoice biaya pendaftaran untuk coder baru yang belum memiliki invoice."
            />

            {/* Fee Info Card */}
            {settings && (
                <div className="card card-p">
                    <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
                        <div>
                            <div className="muted" style={{ fontSize: 12 }}>Biaya Pendaftaran</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(settings.registration_fee)}</div>
                        </div>
                        <div>
                            <div className="muted" style={{ fontSize: 12 }}>Diskon</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{settings.registration_fee_discount_percent}%</div>
                        </div>
                        <div>
                            <div className="muted" style={{ fontSize: 12 }}>Total Bayar</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(calculateFinalFee())}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Message */}
            {message && (
                <div className={`badge ${message.type === 'success' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '10px 14px', fontSize: 13 }}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                </div>
            )}

            <div className="row between" style={{ marginBottom: 8 }}>
                <span className="muted">{coders.length} coder belum memiliki invoice pendaftaran</span>
                {coders.length > 0 && (
                    <button className="btn btn-primary" onClick={handleGenerateAll} disabled={generating === 'all'}>
                        {generating === 'all' ? 'Generating...' : 'Generate Semua'}
                    </button>
                )}
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Nama Coder</th>
                                <th>Orang Tua</th>
                                <th>No. HP</th>
                                <th>Terdaftar</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {coders.length === 0 ? (
                                <tr><td colSpan={5} className="empty">Semua coder sudah memiliki invoice pendaftaran</td></tr>
                            ) : (
                                coders.map((coder) => (
                                    <tr key={coder.id}>
                                        <td><span style={{ fontWeight: 600 }}>{coder.full_name}</span></td>
                                        <td>{coder.parent_name || '—'}</td>
                                        <td>
                                            {coder.parent_contact_phone || (
                                                <span className="badge badge-danger">Tidak ada</span>
                                            )}
                                        </td>
                                        <td className="muted" style={{ fontSize: 12.5 }}>{formatDate(coder.created_at)}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {coder.parent_contact_phone ? (
                                                <button
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleGenerate(coder.id)}
                                                    disabled={generating === coder.id}
                                                >
                                                    {generating === coder.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                    {generating === coder.id ? 'Processing...' : 'Generate'}
                                                </button>
                                            ) : (
                                                <span className="muted" style={{ fontSize: 12 }}>Perlu no. HP</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Styles
const loadingStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#64748b',
    padding: '3rem',
    justifyContent: 'center',
};

const headerStyle: CSSProperties = {
    marginBottom: '1.5rem',
};

const iconBoxStyle: CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
};

const feeCardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const successBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    color: '#166534',
    fontSize: '0.9rem',
    marginBottom: '1rem',
};

const errorBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.9rem',
    marginBottom: '1rem',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
};

const generateAllButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1.25rem',
    background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
};

const tableContainerStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '0.75rem 1rem',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '0.9rem',
    color: '#475569',
};

const trStyle: CSSProperties = {
    transition: 'background 0.15s',
};

const emptyStyle: CSSProperties = {
    padding: '3rem',
    textAlign: 'center',
    color: '#94a3b8',
};

const generateButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.375rem 0.75rem',
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
};
