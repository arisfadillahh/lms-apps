'use client';

import { useState, type CSSProperties, type FormEvent, useRef, useCallback } from 'react';
import { Megaphone, Send, CheckCircle, AlertCircle, Bold, Italic, Link, Image as ImageIcon, List, Undo, Redo } from 'lucide-react';

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
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    const execCommand = useCallback((command: string, value?: string) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    }, []);

    const insertLink = useCallback(() => {
        const url = prompt('Enter URL:');
        if (url) {
            execCommand('createLink', url);
        }
    }, [execCommand]);

    const insertImage = useCallback(() => {
        const url = prompt('Enter image URL:');
        if (url) {
            execCommand('insertImage', url);
        }
    }, [execCommand]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editorRef.current) return;

        const message = editorRef.current.innerHTML;
        if (!message.trim() || message === '<br>') {
            setResult({ success: false, error: 'Pesan tidak boleh kosong' });
            return;
        }

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
                setTitle('');
                if (editorRef.current) {
                    editorRef.current.innerHTML = '';
                }
            }
        } catch (err) {
            setResult({ success: false, error: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ width: '100%' }}>
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
                <div style={result.success ? resultBannerSuccessStyle : resultBannerErrorStyle}>
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
                                {t === 'ALL' ? 'Semua User' : t === 'COACHES' ? 'Coach' : 'Coder'}
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

                {/* Rich Text Editor */}
                <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Isi Pesan</label>

                    {/* Toolbar */}
                    <div style={toolbarStyle}>
                        <button type="button" onClick={() => execCommand('bold')} style={toolbarButtonStyle} title="Bold">
                            <Bold size={18} />
                        </button>
                        <button type="button" onClick={() => execCommand('italic')} style={toolbarButtonStyle} title="Italic">
                            <Italic size={18} />
                        </button>
                        <div style={toolbarDividerStyle} />
                        <button type="button" onClick={insertLink} style={toolbarButtonStyle} title="Insert Link">
                            <Link size={18} />
                        </button>
                        <button type="button" onClick={insertImage} style={toolbarButtonStyle} title="Insert Image">
                            <ImageIcon size={18} />
                        </button>
                        <div style={toolbarDividerStyle} />
                        <button type="button" onClick={() => execCommand('insertUnorderedList')} style={toolbarButtonStyle} title="Bullet List">
                            <List size={18} />
                        </button>
                        <div style={toolbarDividerStyle} />
                        <button type="button" onClick={() => execCommand('undo')} style={toolbarButtonStyle} title="Undo">
                            <Undo size={18} />
                        </button>
                        <button type="button" onClick={() => execCommand('redo')} style={toolbarButtonStyle} title="Redo">
                            <Redo size={18} />
                        </button>
                    </div>

                    {/* Editable Content Area */}
                    <div
                        ref={editorRef}
                        contentEditable
                        style={editorStyle}
                        onPaste={(e) => {
                            // Allow rich paste
                        }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        Gunakan toolbar di atas untuk menambahkan format, link, atau gambar
                    </p>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading || !title.trim()}
                    style={{
                        ...submitButtonStyle,
                        opacity: loading || !title.trim() ? 0.6 : 1,
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
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
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

const toolbarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.5rem',
    background: '#f8fafc',
    borderRadius: '10px 10px 0 0',
    border: '1px solid #e2e8f0',
    borderBottom: 'none',
};

const toolbarButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.5rem',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    transition: 'all 0.15s',
};

const toolbarDividerStyle: CSSProperties = {
    width: '1px',
    height: '20px',
    background: '#e2e8f0',
    margin: '0 0.25rem',
};

const editorStyle: CSSProperties = {
    minHeight: '200px',
    padding: '1rem',
    borderRadius: '0 0 10px 10px',
    border: '1px solid #e2e8f0',
    fontSize: '0.95rem',
    outline: 'none',
    lineHeight: '1.6',
    overflowY: 'auto',
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

const resultBannerSuccessStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#86efac',
    background: '#f0fdf4',
    color: '#15803d',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
    fontWeight: 500,
};

const resultBannerErrorStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    borderRadius: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    marginBottom: '1.5rem',
    fontSize: '0.95rem',
    fontWeight: 500,
};
