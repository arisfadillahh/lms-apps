'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import type { InvoiceSettings } from '@/lib/types/invoice';

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div onClick={() => onChange(!checked)} style={{
            width: 48, height: 26, borderRadius: 13, cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            backgroundColor: checked ? '#25d366' : '#d1d5db',
        }}>
            <div style={{
                width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', position: 'absolute', top: 2,
                left: checked ? 24 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }} />
        </div>
    );
}

type Template = {
    id: string;
    category: string;
    template_content: string;
    variables: string[];
    updated_at: string;
};

const DEFAULT_TEMPLATE = {
    content: `Halo {nama_orangtua},

Kami informasikan bahwa *{nama_siswa}* {status} pada sesi kelas *{nama_kelas}* tanggal {tanggal} pukul {waktu} WIB.

{alasan}*Tugas Susulan:*
{instruksi}

Batas pengumpulan: {batas_pengumpulan}
Link tugas: {link_tugas}

Mohon pastikan tugas susulan dikerjakan tepat waktu.
Terima kasih 🙏`,
    variables: ['nama_orangtua', 'nama_siswa', 'nama_kelas', 'tanggal', 'waktu', 'status', 'alasan', 'instruksi', 'batas_pengumpulan', 'link_tugas'],
};

const SAMPLE_DATA: Record<string, string> = {
    nama_orangtua: 'Bapak Rizki',
    nama_siswa: 'Ahmad Rizki',
    nama_kelas: 'Scratch Beginner - Sabtu',
    tanggal: 'Sabtu, 15 Februari 2026',
    waktu: '10:00',
    status: 'tidak hadir',
    alasan: 'Alasan: Sakit\n',
    instruksi: 'Buat project Scratch sesuai instruksi di LMS.',
    batas_pengumpulan: '22 Februari 2026',
    link_tugas: 'https://lms.clevio.co/coder/makeup/abc123',
};

interface WhatsAppTemplatesProps {
    settings: Partial<InvoiceSettings>;
    settingsMsg: { type: 'success' | 'error'; text: string } | null;
    savingSettings: boolean;
    onSettingChange: (key: string, value: any) => void;
    onSave: () => void;
}

export default function WhatsAppTemplatesContent({ settings, settingsMsg, savingSettings, onSettingChange, onSave }: WhatsAppTemplatesProps) {
    const [template, setTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editedContent, setEditedContent] = useState(DEFAULT_TEMPLATE.content);
    const [showPreview, setShowPreview] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => { fetchTemplate(); }, []);
    useEffect(() => {
        if (msg) { const t = setTimeout(() => setMsg(null), 3000); return () => clearTimeout(t); }
    }, [msg]);

    async function fetchTemplate() {
        try {
            const res = await fetch('/api/admin/whatsapp/templates');
            const data = await res.json();
            const found = (data.templates || []).find((t: Template) => t.category === 'PARENT_ABSENT');
            setTemplate(found || null);
            setEditedContent(found?.template_content || DEFAULT_TEMPLATE.content);
        } catch (e) { console.error('Failed to fetch template:', e); }
        finally { setLoading(false); }
    }

    async function handleSave() {
        setSaving(true);
        setMsg(null);
        try {
            const method = template ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/whatsapp/templates', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: template?.id,
                    category: 'PARENT_ABSENT',
                    templateContent: editedContent,
                    variables: DEFAULT_TEMPLATE.variables,
                }),
            });
            if (res.ok) {
                await fetchTemplate();
                setMsg({ type: 'success', text: 'Template berhasil disimpan!' });
            } else {
                const d = await res.json();
                setMsg({ type: 'error', text: d.error || 'Gagal menyimpan' });
            }
        } catch { setMsg({ type: 'error', text: 'Gagal menyimpan template' }); }
        finally { setSaving(false); }
    }

    function getPreview(): string {
        let preview = editedContent;
        for (const [k, v] of Object.entries(SAMPLE_DATA)) {
            preview = preview.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
        return preview;
    }

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Memuat...</div>;

    const hasChanges = editedContent !== (template?.template_content || DEFAULT_TEMPLATE.content);

    return (
        <div>
            {/* Toggle */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={titleStyle}>Notifikasi Absensi ke Orang Tua</h2>
                        <p style={descStyle}>Kirim pesan WhatsApp otomatis ke orang tua ketika coach menandai siswa tidak hadir atau izin.</p>
                    </div>
                    <ToggleSwitch checked={settings.enable_absent_notification ?? true} onChange={(v) => onSettingChange('enable_absent_notification', v)} />
                </div>
                {settingsMsg && <div style={settingsMsg.type === 'success' ? successMsgStyle : errorMsgStyle}>{settingsMsg.text}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button onClick={onSave} disabled={savingSettings} style={greenBtnStyle}>
                        {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                    </button>
                </div>
            </div>

            {msg && <div style={msg.type === 'success' ? successMsgStyle : errorMsgStyle}>{msg.text}</div>}

            {/* Template Editor */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <h3 style={{ ...titleStyle, fontSize: 16 }}>⚠️ Template Pesan Absensi</h3>
                        <p style={descStyle}>Pesan yang dikirim ke orang tua saat siswa tidak hadir / izin</p>
                    </div>
                    {hasChanges && <span style={unsavedBadge}>Belum disimpan</span>}
                </div>

                {/* Editor / Preview toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>Isi Pesan</label>
                    <button onClick={() => setShowPreview(!showPreview)} style={outlineBtnStyle}>
                        {showPreview ? '✏️ Edit' : '👁️ Preview'}
                    </button>
                </div>

                {showPreview ? (
                    <div style={previewBox}>
                        <p style={{ fontSize: 11, color: '#15803d', fontWeight: 600, margin: '0 0 8px 0' }}>Preview dengan data contoh:</p>
                        <pre style={{ margin: 0, fontSize: 13, color: '#166534', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6 }}>{getPreview()}</pre>
                    </div>
                ) : (
                    <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        style={textareaStyle}
                        rows={8}
                    />
                )}

                {/* Variables */}
                <div style={variablesBox}>
                    <p style={{ fontSize: 12, color: '#64748b', fontWeight: 500, margin: '0 0 6px 0' }}>Variabel yang tersedia:</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {DEFAULT_TEMPLATE.variables.map(v => (
                            <code key={v} style={varTag}>{`{${v}}`}</code>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditedContent(DEFAULT_TEMPLATE.content)} style={outlineBtnStyle}>↺ Reset Default</button>
                    <button onClick={handleSave} style={{ ...greenBtnStyle, opacity: !hasChanges ? 0.5 : 1 }} disabled={saving || !hasChanges}>
                        {saving ? 'Menyimpan...' : '💾 Simpan Template'}
                    </button>
                </div>

                {template && (
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, marginBottom: 0 }}>
                        Terakhir diupdate: {new Date(template.updated_at).toLocaleString('id-ID')}
                    </p>
                )}
            </div>
        </div>
    );
}

// Styles
const cardStyle: CSSProperties = { backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 };
const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 600, margin: '0 0 4px 0', color: '#0f172a' };
const descStyle: CSSProperties = { color: '#64748b', fontSize: 14, margin: 0 };
const unsavedBadge: CSSProperties = { backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' };
const textareaStyle: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, color: '#0f172a', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 };
const previewBox: CSSProperties = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, marginBottom: 12 };
const variablesBox: CSSProperties = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: 8, marginBottom: 16 };
const varTag: CSSProperties = { fontSize: 12, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' };
const outlineBtnStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const greenBtnStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#25d366', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const successMsgStyle: CSSProperties = { backgroundColor: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };
const errorMsgStyle: CSSProperties = { backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14 };
