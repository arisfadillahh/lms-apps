'use client';

import type { CSSProperties } from 'react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Save, RefreshCw } from 'lucide-react';

type Template = {
    id: string;
    category: 'PARENT_ABSENT' | 'REPORT_SEND' | 'REMINDER';
    template_content: string;
    variables: string[];
    updated_at: string;
};

const CATEGORIES = [
    { key: 'PARENT_ABSENT', label: 'Notifikasi Absensi ke Orang Tua', description: 'Dikirim ketika anak tidak hadir' },
    { key: 'REPORT_SEND', label: 'Pengiriman Rapor', description: 'Dikirim bersama file PDF rapor' },
    { key: 'REMINDER', label: 'Reminder Pembayaran', description: 'Pengingat jatuh tempo pembayaran' },
] as const;

const DEFAULT_TEMPLATES: Record<string, { content: string; variables: string[] }> = {
    PARENT_ABSENT: {
        content: 'Halo Bapak/Ibu, kami informasikan bahwa {nama_siswa} tidak hadir pada kelas {nama_kelas} hari ini ({tanggal}). Mohon segera mengerjakan tugas susulan. Terima kasih.',
        variables: ['nama_siswa', 'nama_kelas', 'tanggal'],
    },
    REPORT_SEND: {
        content: 'Halo Bapak/Ibu, berikut adalah rapor {nama_siswa} untuk periode {periode}. Silakan unduh dan simpan sebagai dokumentasi. Terima kasih atas kepercayaan Anda.',
        variables: ['nama_siswa', 'periode'],
    },
    REMINDER: {
        content: 'Halo Bapak/Ibu, ini adalah pengingat pembayaran untuk {nama_siswa}. Tagihan sebesar {nominal} akan jatuh tempo pada {tanggal_jatuh_tempo}. Mohon segera melakukan pembayaran. Terima kasih.',
        variables: ['nama_siswa', 'nominal', 'tanggal_jatuh_tempo'],
    },
};

export default function WhatsAppTemplatesPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editedContent, setEditedContent] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchTemplates();
    }, []);

    async function fetchTemplates() {
        try {
            const res = await fetch('/api/admin/whatsapp/templates');
            const data = await res.json();
            setTemplates(data.templates || []);

            // Initialize edited content
            const initial: Record<string, string> = {};
            CATEGORIES.forEach(cat => {
                const existing = (data.templates || []).find((t: Template) => t.category === cat.key);
                initial[cat.key] = existing?.template_content || DEFAULT_TEMPLATES[cat.key].content;
            });
            setEditedContent(initial);
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(category: string) {
        setSaving(category);
        try {
            const existing = templates.find(t => t.category === category);
            const method = existing ? 'PUT' : 'POST';

            const res = await fetch('/api/admin/whatsapp/templates', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: existing?.id,
                    category,
                    templateContent: editedContent[category],
                    variables: DEFAULT_TEMPLATES[category as keyof typeof DEFAULT_TEMPLATES].variables,
                }),
            });

            if (res.ok) {
                fetchTemplates();
            } else {
                const data = await res.json();
                alert(data.error || 'Gagal menyimpan template');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Gagal menyimpan template');
        } finally {
            setSaving(null);
        }
    }

    function handleReset(category: string) {
        setEditedContent(prev => ({
            ...prev,
            [category]: DEFAULT_TEMPLATES[category as keyof typeof DEFAULT_TEMPLATES].content,
        }));
    }

    if (loading) {
        return <div style={{ padding: '2rem', color: '#64748b' }}>Memuat template...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <header>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <MessageCircle size={24} style={{ color: '#25D366' }} />
                    Template Pesan WhatsApp
                </h1>
                <p style={{ color: '#64748b', maxWidth: '48rem' }}>
                    Kustomisasi isi pesan WhatsApp yang dikirim ke orang tua. Gunakan placeholder dalam kurung kurawal untuk data dinamis.
                </p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {CATEGORIES.map(cat => {
                    const template = templates.find(t => t.category === cat.key);
                    const hasChanges = editedContent[cat.key] !== (template?.template_content || DEFAULT_TEMPLATES[cat.key].content);

                    return (
                        <div key={cat.key} style={cardStyle}>
                            <div style={{ marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                                    {cat.label}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{cat.description}</p>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={labelStyle}>Isi Pesan</label>
                                <textarea
                                    value={editedContent[cat.key] || ''}
                                    onChange={(e) => setEditedContent(prev => ({ ...prev, [cat.key]: e.target.value }))}
                                    style={textareaStyle}
                                    rows={4}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem', background: '#f0fdf4', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                <p style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 500, marginBottom: '0.25rem' }}>
                                    Variabel yang tersedia:
                                </p>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {DEFAULT_TEMPLATES[cat.key].variables.map(v => (
                                        <code key={v} style={variableStyle}>{`{${v}}`}</code>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => handleReset(cat.key)} style={resetBtnStyle}>
                                    <RefreshCw size={14} />
                                    Reset Default
                                </button>
                                <button
                                    onClick={() => handleSave(cat.key)}
                                    style={{ ...saveBtnStyle, opacity: !hasChanges ? 0.5 : 1 }}
                                    disabled={saving === cat.key || !hasChanges}
                                >
                                    <Save size={14} />
                                    {saving === cat.key ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>

                            {template && (
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem' }}>
                                    Terakhir diupdate: {new Date(template.updated_at).toLocaleString()}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const cardStyle: CSSProperties = {
    background: '#ffffff',
    borderRadius: '0.75rem',
    border: '1px solid #e5e7eb',
    padding: '1.5rem',
};

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#334155',
    marginBottom: '0.35rem',
};

const textareaStyle: CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    color: '#0f172a',
    resize: 'vertical',
    fontFamily: 'inherit',
};

const variableStyle: CSSProperties = {
    fontSize: '0.75rem',
    background: '#dcfce7',
    color: '#166534',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
};

const resetBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#475569',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
};

const saveBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#25D366',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
};
