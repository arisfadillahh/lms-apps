'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { X, Loader2, Send, Plus, Trash2 } from 'lucide-react';

interface Pricing {
    id: string;
    level_id: string;
    mode: string;
    base_price_monthly: number;
    is_active: boolean;
    levels: { id: string; name: string } | null;
    pricing_type: 'WEEKLY' | 'SEASONAL';
    seasonal_name?: string;
}

interface PaymentPlan {
    id: string;
    name: string;
    duration_months: number;
    discount_percent: number;
}

interface WeeklyRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface StudentForm {
    id: string;
    name: string;
    pricingId: string;
    paymentPlanId: string;
    registrationFee: number;
    registrationDiscount: number;
    discountAmount: number;
    startDate: string;
}

export default function WeeklyRegistrationModal({ isOpen, onClose, onSuccess }: WeeklyRegistrationModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [pricingOptions, setPricingOptions] = useState<Pricing[]>([]);
    const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
    const [settings, setSettings] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    interface SuccessData {
        invoiceNumber: string;
        publicUrl: string;
        dueDate: string;
    }

    const [success, setSuccess] = useState<SuccessData | null>(null);

    // Form State
    const [parentName, setParentName] = useState('');
    const [parentPhone, setParentPhone] = useState('');

    const [students, setStudents] = useState<StudentForm[]>([{
        id: '1',
        name: '',
        pricingId: '',
        paymentPlanId: '',
        registrationFee: 150000,
        registrationDiscount: 0,
        discountAmount: 0,
        startDate: new Date().toISOString().split('T')[0]
    }]);

    // Format Currency Helper
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Pricing (Using Seasonal endpoint as it returns all pricing)
            const pricingRes = await fetch('/api/admin/invoices/seasonal');
            if (pricingRes.ok) {
                const data = await pricingRes.json();
                // Filter for WEEKLY only
                const weeklyParams = (data.pricing || []).filter((p: Pricing) => p.pricing_type !== 'SEASONAL');
                setPricingOptions(weeklyParams);
            }

            // Fetch Plans -- We'll try to fetch from periods endpoint or assume we need to add a dedicated endpoint if fails.
            // For now, let's use the `GET` on `payments/periods` if it returns plans, OR `payments/plans`.
            // Let's assume we created `/api/admin/payments/plans` OR just fetch all periods and extract unique plans? No that's heavy.
            // Since we don't have a dedicated plans endpoint, I will assume one exists or I will create it.
            // Actually, to be safe, I'll fetch `api/admin/payments/periods` and hope it contains metadata, OR just hardcode common plans if fetch fails?
            // BETTER: I will quickly create a `GET /api/admin/payments/plans` in the background if I can.
            // For this code, let's try to fetch `/api/admin/payments/plans` and handle error.

            // Correction: I'll use `api/admin/payments/periods` but if it's too heavy...
            // Let's try to fetch a known endpoint. `api/admin/payments/plans` doesn't exist yet.
            // I will create it.

            // Let's just create a raw fetch here that we expect to work.
            const plansRes = await fetch('/api/admin/payments/plans');
            if (plansRes.ok) {
                setPaymentPlans(await plansRes.json());
            } else {
                // Fallback or empty
                console.warn('Plans endpoint not found');
            }

            const settingsRes = await fetch('/api/invoices/settings');
            if (settingsRes.ok) {
                setSettings(await settingsRes.json());
            }

        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---

    const addStudent = () => {
        setStudents([...students, {
            id: Math.random().toString(),
            name: '',
            pricingId: '',
            paymentPlanId: '',
            registrationFee: 150000,
            registrationDiscount: 0,
            discountAmount: 0,
            startDate: new Date().toISOString().split('T')[0]
        }]);
    };

    const removeStudent = (id: string) => {
        if (students.length <= 1) return;
        setStudents(students.filter(s => s.id !== id));
    };

    const updateStudent = (id: string, field: keyof StudentForm, value: any) => {
        setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const calculateStudentTotal = (student: StudentForm) => {
        const pricing = pricingOptions.find(p => p.id === student.pricingId);
        const plan = paymentPlans.find(p => p.id === student.paymentPlanId);

        let packageTotal = 0;
        if (pricing && plan) {
            const baseTotal = pricing.base_price_monthly * plan.duration_months;
            const discountVal = (baseTotal * plan.discount_percent) / 100;
            packageTotal = Math.max(0, baseTotal - discountVal - student.discountAmount);
        }

        const regTotal = Math.max(0, student.registrationFee - (student.registrationFee * student.registrationDiscount / 100));

        return packageTotal + regTotal;
    };

    const grandTotal = students.reduce((acc, s) => acc + calculateStudentTotal(s), 0);
    const canSubmit = parentName && parentPhone && students.every(s => s.name && s.pricingId && s.paymentPlanId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const payload = {
                parentName,
                parentPhone,
                students: students.map(s => {
                    const pricing = pricingOptions.find(p => p.id === s.pricingId);
                    const plan = paymentPlans.find(p => p.id === s.paymentPlanId);

                    const baseTotal = (pricing?.base_price_monthly || 0) * (plan?.duration_months || 0);
                    const planDiscount = (baseTotal * (plan?.discount_percent || 0)) / 100;
                    const packageTotal = Math.max(0, baseTotal - planDiscount - s.discountAmount);

                    const regTotal = Math.max(0, s.registrationFee - (s.registrationFee * s.registrationDiscount / 100));

                    // Calculate End Date roughly based on duration
                    const endDate = new Date(s.startDate);
                    if (plan) {
                        endDate.setMonth(endDate.getMonth() + plan.duration_months);
                    }

                    return {
                        name: s.name,
                        pricingId: s.pricingId,
                        paymentPlanId: s.paymentPlanId,
                        startDate: s.startDate,
                        endDate: endDate.toISOString().split('T')[0],
                        totalAmount: packageTotal,
                        registrationFee: s.registrationFee,
                        registrationDiscount: s.registrationDiscount,
                        registrationTotal: regTotal,
                    };
                })
            };

            const res = await fetch('/api/admin/invoices/weekly-registration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal membuat invoice');

            setSuccess({
                invoiceNumber: data.invoice.invoice_number,
                publicUrl: data.invoice.public_url,
                dueDate: data.invoice.due_date // Capture due date
            });
            onSuccess(); // Refresh parent list
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Terjadi kesalahan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        // Reset state or keep? strictly close
        setParentName('');
        setParentPhone('');
        setStudents([{
            id: '1', name: '', pricingId: '', paymentPlanId: '',
            registrationFee: 150000, registrationDiscount: 0, discountAmount: 0,
            startDate: new Date().toISOString().split('T')[0]
        }]);
        setSuccess(null);
        onClose();
    };

    const sendWhatsApp = () => {
        if (!success) return;

        let template = settings?.weekly_invoice_message_template ||
            "Halo {{parent_name}},\n\nInvoice: {{invoice_number}}\nLink: {{invoice_link}}\nJatuh Tempo: {{due_date}}";

        // Format Date to Indonesian format (e.g., 10 Februari 2026)
        const formattedDueDate = new Date(success.dueDate).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        // Replace variables
        const studentList = students.map(s => `- ${s.name}`).join('\n');

        const msg = template
            .replace('{{parent_name}}', parentName)
            .replace('{{invoice_number}}', success.invoiceNumber)
            .replace('{{invoice_link}}', success.publicUrl)
            .replace('{{due_date}}', formattedDueDate)
            .replace('{{students}}', studentList);

        const url = `https://wa.me/${parentPhone.replace(/^0/, '62')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                        {success ? '✅ Invoice Berhasil (Weekly)' : '📝 Registrasi Weekly Baru'}
                    </h2>
                    <button onClick={handleClose} style={closeBtnStyle}><X size={20} /></button>
                </div>

                {/* Body */}
                <div style={bodyStyle}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Loader2 className="animate-spin" /> Memuat data...
                        </div>
                    ) : success ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>🎉 Invoice Siap!</h3>
                            <p>Nomor Invoice: <strong>{success.invoiceNumber}</strong></p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                                <button onClick={sendWhatsApp} style={primaryBtnStyle}>
                                    <Send size={16} style={{ marginRight: 8 }} /> Kirim WA
                                </button>
                                <button onClick={handleClose} style={secondaryBtnStyle}>Tutup</button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {/* Parent Info */}
                            <div style={sectionStyle}>
                                <h3 style={sectionTitleStyle}>👤 Data Orang Tua</h3>
                                <div style={rowStyle}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Nama Orang Tua *</label>
                                        <input
                                            required
                                            value={parentName}
                                            onChange={e => setParentName(e.target.value)}
                                            style={inputStyle}
                                            placeholder="Nama Lengkap"
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>WhatsApp *</label>
                                        <input
                                            required
                                            type="tel"
                                            value={parentPhone}
                                            onChange={e => setParentPhone(e.target.value)}
                                            style={inputStyle}
                                            placeholder="08xxxxx"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Students Loop */}
                            <div style={sectionStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={sectionTitleStyle}>🎓 Data Siswa ({students.length})</h3>
                                    <button type="button" onClick={addStudent} style={smallAddBtnStyle}>
                                        <Plus size={14} /> Tambah Siswa
                                    </button>
                                </div>

                                {students.map((student, index) => (
                                    <div key={student.id} style={studentCardStyle}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, color: '#475569' }}>Siswa #{index + 1}</span>
                                            {students.length > 1 && (
                                                <button type="button" onClick={() => removeStudent(student.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Name & Date */}
                                        <div style={rowStyle}>
                                            <div style={{ flex: 1 }}>
                                                <label style={labelStyle}>Nama Siswa *</label>
                                                <input
                                                    value={student.name}
                                                    onChange={e => updateStudent(student.id, 'name', e.target.value)}
                                                    style={inputStyle}
                                                    required
                                                    placeholder="Nama Lengkap Anak"
                                                />
                                            </div>
                                            <div style={{ width: '150px' }}>
                                                <label style={labelStyle}>Mulai Kursus *</label>
                                                <input
                                                    type="date"
                                                    value={student.startDate}
                                                    onChange={e => updateStudent(student.id, 'startDate', e.target.value)}
                                                    style={inputStyle}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Plan Selection */}
                                        <div style={rowStyle}>
                                            <div style={{ flex: 1 }}>
                                                <label style={labelStyle}>Pilih Level/Kelas *</label>
                                                <select
                                                    value={student.pricingId}
                                                    onChange={e => updateStudent(student.id, 'pricingId', e.target.value)}
                                                    style={inputStyle}
                                                    required
                                                >
                                                    <option value="">-- Level --</option>
                                                    {pricingOptions.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.levels?.name || 'Level'} ({p.mode}) - {formatCurrency(p.base_price_monthly)}/bln
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label style={labelStyle}>Pilih Paket *</label>
                                                <select
                                                    value={student.paymentPlanId}
                                                    onChange={e => updateStudent(student.id, 'paymentPlanId', e.target.value)}
                                                    style={inputStyle}
                                                    required
                                                >
                                                    <option value="">-- Paket --</option>
                                                    {paymentPlans.map(p => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name} ({p.duration_months} bln) - Disc {p.discount_percent}%
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Fees & Discounts */}
                                        <div style={{ background: '#f1f5f9', padding: '0.8rem', borderRadius: '6px', marginTop: '0.5rem' }}>
                                            <div style={rowStyle}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Biaya Daftar</label>
                                                    <input
                                                        type="number"
                                                        value={student.registrationFee}
                                                        onChange={e => updateStudent(student.id, 'registrationFee', Number(e.target.value))}
                                                        style={compactInputStyle}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Disc Daftar (%)</label>
                                                    <input
                                                        type="number"
                                                        min="0" max="100"
                                                        value={student.registrationDiscount}
                                                        onChange={e => updateStudent(student.id, 'registrationDiscount', Number(e.target.value))}
                                                        style={compactInputStyle}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Potongan Paket (Rp)</label>
                                                    <input
                                                        type="number"
                                                        value={student.discountAmount}
                                                        onChange={e => updateStudent(student.id, 'discountAmount', Number(e.target.value))}
                                                        style={compactInputStyle}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', marginTop: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#1e3a5f' }}>
                                                Subtotal Siswa: {formatCurrency(calculateStudentTotal(student))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer / Grand Total */}
                            <div style={footerStyle}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                                    Total: <span style={{ fontSize: '1.4rem', color: '#1e3a5f' }}>{formatCurrency(grandTotal)}</span>
                                </div>
                                <button type="submit" disabled={!canSubmit || submitting} style={primaryBtnStyle}>
                                    {submitting ? 'Memproses...' : 'Buat Invoice'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// Styles
const overlayStyle: CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem'
};
const modalStyle: CSSProperties = {
    background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '650px', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
};
const headerStyle: CSSProperties = {
    padding: '1.2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc'
};
const bodyStyle: CSSProperties = {
    padding: '1.5rem', overflowY: 'auto'
};
const sectionStyle: CSSProperties = { marginBottom: '1.5rem' };
const sectionTitleStyle: CSSProperties = { fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginBottom: '0.8rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.3rem' };
const rowStyle: CSSProperties = { display: 'flex', gap: '1rem', marginBottom: '0.8rem' };
const labelStyle: CSSProperties = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' };
const inputStyle: CSSProperties = { width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' };
const compactInputStyle: CSSProperties = { ...inputStyle, padding: '0.3rem 0.5rem', fontSize: '0.85rem' };
const studentCardStyle: CSSProperties = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', background: '#fff' };
const footerStyle: CSSProperties = { marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const primaryBtnStyle: CSSProperties = { background: '#1e3a5f', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' };
const secondaryBtnStyle: CSSProperties = { background: '#94a3b8', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' };
const closeBtnStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' };
const smallAddBtnStyle: CSSProperties = { background: '#dbeafe', color: '#2563eb', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' };
