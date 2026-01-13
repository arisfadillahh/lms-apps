'use client';

import { useState, useTransition, useMemo, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

type SessionOption = {
    id: string;
    dateTime: string;
    className: string;
    coachId: string;
    coachName: string;
};

type CoachOption = {
    id: string;
    name: string;
};

interface EmergencyLeaveFormProps {
    sessions: SessionOption[];
    coaches: CoachOption[];
}

export default function EmergencyLeaveForm({ sessions, coaches }: EmergencyLeaveFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [open, setOpen] = useState(false);

    // Step 1: Select Coach first
    const [selectedCoach, setSelectedCoach] = useState('');
    // Step 2: Select Session (filtered by coach)
    const [selectedSession, setSelectedSession] = useState('');
    // Step 3: Select Substitute
    const [selectedSubstitute, setSelectedSubstitute] = useState('');
    const [note, setNote] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Filter sessions by selected coach
    const coachSessions = useMemo(() => {
        if (!selectedCoach) return [];
        return sessions.filter((s) => s.coachId === selectedCoach);
    }, [sessions, selectedCoach]);

    // Filter out the selected coach from substitute options
    const substituteOptions = useMemo(() => {
        return coaches.filter((c) => c.id !== selectedCoach);
    }, [coaches, selectedCoach]);

    const handleCoachChange = (coachId: string) => {
        setSelectedCoach(coachId);
        setSelectedSession('');
        setSelectedSubstitute('');
    };

    const handleSubmit = () => {
        setErrorMessage(null);
        setSuccessMessage(null);

        if (!selectedCoach || !selectedSession || !selectedSubstitute) {
            setErrorMessage('Lengkapi semua pilihan');
            return;
        }

        startTransition(async () => {
            try {
                const response = await fetch('/api/admin/leave/emergency', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        coachId: selectedCoach,
                        sessionId: selectedSession,
                        substituteCoachId: selectedSubstitute,
                        note: note || 'Izin Darurat',
                    }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    setErrorMessage(data.error || 'Gagal membuat izin darurat');
                    return;
                }

                setSuccessMessage('Izin darurat berhasil dibuat!');
                setSelectedCoach('');
                setSelectedSession('');
                setSelectedSubstitute('');
                setNote('');
                router.refresh();
                setTimeout(() => {
                    setOpen(false);
                    setSuccessMessage(null);
                }, 2000);
            } catch (err) {
                console.error(err);
                setErrorMessage('Terjadi kesalahan');
            }
        });
    };

    const handleClose = () => {
        setOpen(false);
        setSelectedCoach('');
        setSelectedSession('');
        setSelectedSubstitute('');
        setNote('');
        setErrorMessage(null);
    };

    return (
        <>
            <button onClick={() => setOpen(true)} style={triggerButtonStyle}>
                + Izin Darurat
            </button>

            {open && (
                <div style={backdropStyle} onClick={handleClose}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>Buat Izin Darurat</h3>
                        <p style={subtitleStyle}>
                            Gunakan fitur ini jika coach tidak sempat mengajukan izin sendiri. Izin akan langsung disetujui.
                        </p>

                        {/* Step 1: Select Coach */}
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>1. Pilih Coach yang Izin</label>
                            <select
                                value={selectedCoach}
                                onChange={(e) => handleCoachChange(e.target.value)}
                                style={selectStyle}
                            >
                                <option value="">-- Pilih coach --</option>
                                {coaches.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Step 2: Select Session (only show if coach selected) */}
                        {selectedCoach && (
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>2. Pilih Sesi yang Diizinkan</label>
                                {coachSessions.length === 0 ? (
                                    <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Tidak ada sesi mendatang untuk coach ini</p>
                                ) : (
                                    <select
                                        value={selectedSession}
                                        onChange={(e) => setSelectedSession(e.target.value)}
                                        style={selectStyle}
                                    >
                                        <option value="">-- Pilih sesi --</option>
                                        {coachSessions.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.className} - {new Date(s.dateTime).toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}

                        {/* Step 3: Select Substitute (only show if session selected) */}
                        {selectedSession && (
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>3. Pilih Coach Pengganti</label>
                                <select
                                    value={selectedSubstitute}
                                    onChange={(e) => setSelectedSubstitute(e.target.value)}
                                    style={selectStyle}
                                >
                                    <option value="">-- Pilih coach pengganti --</option>
                                    {substituteOptions.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Note (optional) */}
                        {selectedSubstitute && (
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Catatan (opsional)</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Alasan izin darurat..."
                                    style={{ ...selectStyle, minHeight: '80px', resize: 'vertical' }}
                                />
                            </div>
                        )}

                        {errorMessage && <p style={errorStyle}>{errorMessage}</p>}
                        {successMessage && <p style={successStyle}>{successMessage}</p>}

                        <div style={actionsStyle}>
                            <button onClick={handleClose} style={cancelButtonStyle} disabled={isPending}>
                                Batal
                            </button>
                            <button
                                onClick={handleSubmit}
                                style={submitButtonStyle}
                                disabled={isPending || !selectedCoach || !selectedSession || !selectedSubstitute}
                            >
                                {isPending ? 'Memproses...' : 'Buat Izin Darurat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// Styles
const triggerButtonStyle: CSSProperties = {
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const backdropStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    padding: '1.5rem',
};

const modalStyle: CSSProperties = {
    background: '#ffffff',
    padding: '1.5rem',
    borderRadius: '1rem',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
};

const titleStyle: CSSProperties = {
    margin: '0 0 0.25rem 0',
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#0f172a',
};

const subtitleStyle: CSSProperties = {
    margin: '0 0 1.25rem 0',
    fontSize: '0.85rem',
    color: '#64748b',
    lineHeight: 1.5,
};

const formGroupStyle: CSSProperties = {
    marginBottom: '1rem',
};

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#334155',
    marginBottom: '0.35rem',
};

const selectStyle: CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    background: '#fff',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.25rem',
};

const cancelButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#475569',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const submitButtonStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#dc2626',
    color: '#ffffff',
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
    color: '#16a34a',
    fontSize: '0.85rem',
    marginTop: '0.5rem',
};
