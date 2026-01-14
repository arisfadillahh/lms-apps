'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import { Megaphone, Send, CheckCircle, AlertCircle } from 'lucide-react';

type Target = 'ALL' | 'COACHES' | 'CODERS';

type Result = {
    success: boolean;
    sent?: number;
    message?: string;
    error?: string;
};

export default function BroadcastPage() {
    const [target, setTarget] = useState<Target>('ALL');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, title, message }),
            });

            const data = await res.json();

            if (!res.ok) {
                setResult({ success: false, error: data.error || 'Failed to send broadcast' });
            } else {
                setResult({ success: true, sent: data.sent, message: data.message });
                // Reset form on success
                setTitle('');
                setMessage('');
            }
        } catch (err) {
            setResult({ success: false, error: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Megaphone size={28} style={{ color: '#2563eb' }} />
                    Broadcast Notifikasi
                </h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
                    Kirim notifikasi ke semua Coach, Coder, atau keduanya
                </p>
            </div>

            {/* Result Banner */}
            {result && (
                <div style={{
                    ...resultBannerStyle,
                    background: result.success ? '#f0fdf4' : '#fef2f2',
                    borderColor: result.success ? '#86efac' : '#fecaca',
                    color: result.success ? '#15803d' : '#b91c1c',
                }}>
                    {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{result.success ? result.message : result.error}</span>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={formStyle}>
                {/* Target Selection */}
                <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Target Penerima</label>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {(['ALL', 'COACHES', 'CODERS'] as Target[]).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTarget(t)}
                                style={{
                                    ...targetButtonStyle,
                                    ...(target === t ? targetButtonActiveStyle : {}),
                                }}
                            >
                                {t === 'ALL' ? '🎯 Semua' : t === 'COACHES' ? '👨‍🏫 Coach' : '👦 Coder'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Title */}
                <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Judul Notifikasi</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Contoh: Pengumuman Penting"
                        style={inputStyle}
                        maxLength={100}
                        required
                    />
                </div>

                {/* Message */}
                <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Isi Pesan</label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tulis pesan notifikasi di sini..."
                        style={{ ...inputStyle, minHeight: '150px', resize: 'vertical' }}
                        maxLength={1000}
                        required
                    />
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        {message.length}/1000 karakter
                    </p>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading || !title.trim() || !message.trim()}
                    style={{
                        ...submitButtonStyle,
                        opacity: loading || !title.trim() || !message.trim() ? 0.6 : 1,
                        cursor: loading ? 'wait' : 'pointer',
                    }}
                >
                    <Send size={18} />
                    {loading ? 'Mengirim...' : 'Kirim Broadcast'}
                </button>
            </form>
        </div>
    );
}

// Styles
const formStyle: CSSProperties = {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '2rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
};

const fieldGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
};

const labelStyle: CSSProperties = {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#334155',
};

const inputStyle: CSSProperties = {
    padding: '0.875rem 1rem',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
};

const targetButtonStyle: CSSProperties = {
    padding: '0.625rem 1.25rem',
    borderRadius: '10px',
    border: '2px solid #e2e8f0',
    background: '#ffffff',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const targetButtonActiveStyle: CSSProperties = {
    borderColor: '#2563eb',
    background: '#eff6ff',
    color: '#2563eb',
};

const submitButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '1rem',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '0.5rem',
};

const resultBannerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: '12px',
    border: '1px solid',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
    fontWeight: 500,
};
