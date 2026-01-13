'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ReportLessonButtonProps = {
    lessonId: string;
    lessonTitle: string;
    coachId: string;
};

const REPORT_TYPES = [
    { value: 'TOO_DIFFICULT', label: 'Terlalu Sulit' },
    { value: 'UNCLEAR', label: 'Materi Kurang Jelas' },
    { value: 'BUG', label: 'Ada Bug/Error' },
    { value: 'OUTDATED', label: 'Materi Sudah Tidak Relevan' },
    { value: 'OTHER', label: 'Lainnya' },
];

export default function ReportLessonButton({ lessonId, lessonTitle, coachId }: ReportLessonButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [reportType, setReportType] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleClose = () => {
        setOpen(false);
        setReportType('');
        setDescription('');
        setError(null);
        setSuccess(false);
    };

    const handleSubmit = () => {
        if (!reportType) {
            setError('Pilih jenis masalah');
            return;
        }
        if (!description.trim()) {
            setError('Deskripsi wajib diisi');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const response = await fetch('/api/coach/lesson-reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lessonTemplateId: lessonId,
                        reportType,
                        description: description.trim(),
                    }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setError(data.error || 'Gagal mengirim laporan');
                    return;
                }

                setSuccess(true);
                setTimeout(() => {
                    handleClose();
                    router.refresh();
                }, 2000);
            } catch (err) {
                console.error(err);
                setError('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            <button onClick={() => setOpen(true)} style={triggerStyle}>
                ⚠️ Laporkan Masalah
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Laporkan Masalah Lesson</h3>
                        <p style={subtitleStyle}>Lesson: <strong>{lessonTitle}</strong></p>

                        {success ? (
                            <div style={successStyle}>
                                ✅ Laporan berhasil dikirim! Admin akan meninjau.
                            </div>
                        ) : (
                            <>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Jenis Masalah *</label>
                                    <select
                                        value={reportType}
                                        onChange={(e) => setReportType(e.target.value)}
                                        style={selectStyle}
                                    >
                                        <option value="">-- Pilih Jenis Masalah --</option>
                                        {REPORT_TYPES.map((type) => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Deskripsi *</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Jelaskan masalah yang Anda temukan..."
                                        rows={4}
                                        style={{ ...inputStyle, resize: 'vertical' }}
                                    />
                                </div>

                                {error && <p style={errorStyle}>{error}</p>}

                                <div style={actionsStyle}>
                                    <button onClick={handleClose} style={cancelStyle} disabled={isPending}>
                                        Batal
                                    </button>
                                    <button onClick={handleSubmit} style={submitStyle} disabled={isPending}>
                                        {isPending ? 'Mengirim...' : 'Kirim Laporan'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

const triggerStyle: CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    fontSize: '0.85rem',
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
    fontSize: '0.85rem',
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

const selectStyle: CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    color: '#0f172a',
    background: '#fff',
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

const successStyle: CSSProperties = {
    padding: '1rem',
    background: '#f0fdf4',
    color: '#16a34a',
    borderRadius: '0.5rem',
    fontWeight: 500,
    textAlign: 'center',
};
