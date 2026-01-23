'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { X, Loader2, Send } from 'lucide-react';

interface Pricing {
    id: string;
    level_id: string;
    mode: string;
    base_price_monthly: number;
    is_active: boolean;
    levels: { id: string; name: string } | null;
    pricing_type: 'WEEKLY' | 'SEASONAL';
    seasonal_name: string | null;
}

interface SeasonalInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function SeasonalInvoiceModal({ isOpen, onClose, onSuccess }: SeasonalInvoiceModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [pricingOptions, setPricingOptions] = useState<Pricing[]>([]);
    const [settings, setSettings] = useState<any>(null); // Store settings for template
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ invoiceNumber: string; publicUrl: string } | null>(null);

    // Form state
    const [studentName, setStudentName] = useState('');
    const [studentPhone, setStudentPhone] = useState('');
    const [selectedPricingId, setSelectedPricingId] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountDescription, setDiscountDescription] = useState('');
    const [notes, setNotes] = useState('');

    // Fetch pricing options
    useEffect(() => {
        if (isOpen) {
            fetchPricingAndSettings();
        }
    }, [isOpen]);

    const fetchPricingAndSettings = async () => {
        setLoading(true);
        try {
            const [pricingRes, settingsRes] = await Promise.all([
                fetch('/api/admin/invoices/seasonal'),
                fetch('/api/invoices/settings')
            ]);

            if (!pricingRes.ok) throw new Error('Failed to fetch pricing');
            const data = await pricingRes.json();

            // Filter only seasonal pricing or fallback if mixed
            const allPricing = data.pricing || [];
            const seasonalPricing = allPricing.filter((p: Pricing) => p.pricing_type === 'SEASONAL');
            setPricingOptions(seasonalPricing.length > 0 ? seasonalPricing : allPricing);

            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                setSettings(settingsData);
            }
        } catch (err) {
            console.error(err);
            setError('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    const selectedPricing = pricingOptions.find(p => p.id === selectedPricingId);
    const basePrice = selectedPricing?.base_price_monthly || 0;
    const totalAmount = Math.max(0, basePrice - discountAmount);
    const programName = selectedPricing ? (selectedPricing.seasonal_name || selectedPricing.levels?.name || 'Program') : '';

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            const res = await fetch('/api/admin/invoices/seasonal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentName,
                    studentPhone,
                    pricingId: selectedPricingId,
                    discountAmount,
                    discountDescription: discountDescription || undefined,
                    notes: notes || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Gagal membuat invoice');
                return;
            }

            setSuccess({
                invoiceNumber: data.invoice.invoice_number,
                publicUrl: data.invoice.public_url,
            });

            // Dont reset form immediately so user can see what they created if they close preview
            // But we do need to reset if they want to create another one. 
            // For now, let's keep form data but allow creating new one by resetting on close/new.

            // Trigger refresh on parent but keep modal open for preview
            onSuccess();
        } catch (err) {
            console.error(err);
            setError('Terjadi kesalahan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setSuccess(null);
        setError(null);
        onClose();
        // Reset form on full close
        setStudentName('');
        setStudentPhone('');
        setSelectedPricingId('');
        setDiscountAmount(0);
        setDiscountDescription('');
        setNotes('');
    };

    const sendWhatsApp = async () => {
        if (!success) return;

        // Use the admin WhatsApp integration
        // Use the admin WhatsApp integration
        try {
            let messageText = '';

            // Use template if available
            if (settings?.seasonal_invoice_message_template) {
                messageText = settings.seasonal_invoice_message_template
                    .replace(/{student_name}/g, studentName)
                    .replace(/{program_name}/g, programName)
                    .replace(/{invoice_number}/g, success.invoiceNumber)
                    .replace(/{invoice_url}/g, success.publicUrl);
            } else {
                // Default fallback
                messageText = `Halo Kak ${studentName},\n\n` +
                    `Berikut invoice untuk pembayaran program *${programName}*:\n\n` +
                    `📋 Invoice: ${success.invoiceNumber}\n` +
                    `🔗 Link: ${success.publicUrl}\n\n` +
                    `Mohon dilakukan pembayaran sebelum jatuh tempo. Terima kasih!`;
            }

            const message = encodeURIComponent(messageText);

            // Open WhatsApp with pre-filled message
            // Note: In a real "admin connected" scenario, we might want to send properly via API
            // But usually for admin sending manually, opening WA Web/App is preferred to confirm message.
            // User requested: "pas kirim pake whatsapp admin yang udah terhubung di lms ini aja"
            // If they mean AUTOMATICALLY send from server, we would call an API. 
            // If they mean "open wa using the connected number", they might mean just standard WA link.
            // Given "pop up tombol kirim... dan pas kirim pake whatsapp admin", it implies a client action.
            // Let's assume opening WA link is safer for now unless "connected admin" means a bot.
            // Wait, "whatsapp admin yang sudah terhubung" implies the WA Gateway / Baileys integration.
            // So we should try to call the API to send message if possible?
            // "pas kirim pake whatsapp admin" -> likely means use the Server-side WA client.

            // Let's TRY to use the server-side API first for "connected admin" experience.
            setSubmitting(true);
            const res = await fetch('/api/admin/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber: studentPhone,
                    message: decodeURIComponent(message)
                }),
            });

            if (res.ok) {
                alert('Pesan WhatsApp terkirim!');
            } else {
                // Fallback to manual send if server fail or not connected
                const phone = studentPhone.replace(/\D/g, '').replace(/^0/, '62');
                window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
            }

        } catch (error) {
            console.error('Failed to send WA', error);
            // Fallback
            const phone = studentPhone.replace(/\D/g, '').replace(/^0/, '62');
            // Re-encode for URL (fallback logic same as above)
            let messageText = '';
            if (settings?.seasonal_invoice_message_template) {
                messageText = settings.seasonal_invoice_message_template
                    .replace(/{student_name}/g, studentName)
                    .replace(/{program_name}/g, programName)
                    .replace(/{invoice_number}/g, success.invoiceNumber)
                    .replace(/{invoice_url}/g, success.publicUrl);
            } else {
                messageText = `Halo Kak ${studentName},\n\n` +
                    `Berikut invoice untuk pembayaran program *${programName}*:\n\n` +
                    `📋 Invoice: ${success.invoiceNumber}\n` +
                    `🔗 Link: ${success.publicUrl}\n\n` +
                    `Mohon dilakukan pembayaran sebelum jatuh tempo. Terima kasih!`;
            }

            const msg = encodeURIComponent(messageText);
            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={handleClose}>
            <div style={{ ...modalStyle, maxWidth: success ? '800px' : '520px' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={headerStyle}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                        {success ? '✅ Invoice Berhasil Dibuat' : '📅 Buat Invoice Seasonal'}
                    </h2>
                    <button onClick={handleClose} style={closeButtonStyle}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={bodyStyle}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Loader2 size={32} className="animate-spin" style={{ color: '#64748b' }} />
                            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Memuat data...</p>
                        </div>
                    ) : success ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flex: 1, minHeight: '400px' }}>
                                {/* Preview Iframe */}
                                <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                    <iframe
                                        src={success.publicUrl}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                        title="Invoice Preview"
                                    />
                                </div>

                                {/* Actions Sidebar */}
                                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#64748b' }}>Nomor Invoice</h4>
                                        <p style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>{success.invoiceNumber}</p>
                                    </div>

                                    <button onClick={sendWhatsApp} style={waButtonStyle} disabled={submitting}>
                                        <Send size={16} />
                                        {submitting ? 'Mengirim...' : 'Kirim Invoice via WA'}
                                    </button>

                                    <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
                                        <p style={{ margin: 0 }}>
                                            ℹ️ Tombol ini akan mencoba mengirim pesan otomatis menggunakan nomor Admin yang terhubung. Jika gagal, akan membuka WhatsApp Web.
                                        </p>
                                    </div>

                                    <div style={{ flex: 1 }}></div>

                                    <button onClick={handleClose} style={secondaryButtonStyle}>
                                        Tutup / Buat Baru
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {/* Student Info */}
                            <div style={sectionStyle}>
                                <h3 style={sectionTitleStyle}>📋 Data Siswa</h3>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Nama Lengkap *</label>
                                    <input
                                        type="text"
                                        value={studentName}
                                        onChange={e => setStudentName(e.target.value)}
                                        placeholder="Nama siswa"
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>WhatsApp Orang Tua *</label>
                                    <input
                                        type="tel"
                                        value={studentPhone}
                                        onChange={e => setStudentPhone(e.target.value)}
                                        placeholder="08xxxxxxxxxx"
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Pricing */}
                            <div style={sectionStyle}>
                                <h3 style={sectionTitleStyle}>💰 Paket & Harga</h3>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Pilih Level/Paket *</label>
                                    <select
                                        value={selectedPricingId}
                                        onChange={e => setSelectedPricingId(e.target.value)}
                                        required
                                        style={selectStyle}
                                    >
                                        <option value="">-- Pilih --</option>
                                        {pricingOptions.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.seasonal_name || p.levels?.name || 'Unknown'} ({p.mode}) - {formatCurrency(p.base_price_monthly)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedPricing && (
                                    <div style={priceBoxStyle}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Harga Paket:</span>
                                            <span style={{ fontWeight: 600 }}>{formatCurrency(basePrice)}</span>
                                        </div>
                                    </div>
                                )}

                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Diskon (Rp)</label>
                                    <input
                                        type="number"
                                        value={discountAmount}
                                        onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                                        min={0}
                                        max={basePrice}
                                        style={inputStyle}
                                    />
                                </div>

                                {discountAmount > 0 && (
                                    <div style={fieldStyle}>
                                        <label style={labelStyle}>Keterangan Diskon</label>
                                        <input
                                            type="text"
                                            value={discountDescription}
                                            onChange={e => setDiscountDescription(e.target.value)}
                                            placeholder="contoh: Diskon Early Bird"
                                            style={inputStyle}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Total */}
                            {selectedPricing && (
                                <div style={totalBoxStyle}>
                                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>Total Bayar:</span>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a5f' }}>
                                        {formatCurrency(totalAmount)}
                                    </span>
                                </div>
                            )}

                            {/* Notes */}
                            <div style={fieldStyle}>
                                <label style={labelStyle}>Catatan (opsional)</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Catatan tambahan..."
                                    rows={2}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            {error && <p style={errorStyle}>{error}</p>}

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={submitting || !selectedPricingId}
                                style={{
                                    ...submitButtonStyle,
                                    opacity: (submitting || !selectedPricingId) ? 0.6 : 1,
                                }}
                            >
                                {submitting ? 'Membuat Invoice...' : 'Buat Invoice'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

// Styles
const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    zIndex: 1000,
};

const modalStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #e2e8f0',
};

const closeButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: '0.25rem',
};

const bodyStyle: CSSProperties = {
    padding: '1.5rem',
    overflowY: 'auto',
};

const sectionStyle: CSSProperties = {
    marginBottom: '1.5rem',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#1e293b',
    marginBottom: '0.75rem',
};

const fieldStyle: CSSProperties = {
    marginBottom: '0.75rem',
};

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#475569',
    marginBottom: '0.25rem',
};

const inputStyle: CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.9rem',
    color: '#1e293b',
};

const selectStyle: CSSProperties = {
    ...inputStyle,
    background: '#fff',
};

const priceBoxStyle: CSSProperties = {
    background: '#f8fafc',
    padding: '0.75rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: '#475569',
    marginBottom: '0.75rem',
};

const totalBoxStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#eff6ff',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '1rem',
};

const errorStyle: CSSProperties = {
    color: '#dc2626',
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
};

const submitButtonStyle: CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    background: '#1e3a5f',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
};

const successContainerStyle: CSSProperties = {
    textAlign: 'center',
    padding: '1rem',
};

const waButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1rem',
    background: '#25d366',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    background: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};
