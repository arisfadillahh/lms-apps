'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CalendarX, RotateCcw } from 'lucide-react';

import EditSessionDateModal from './EditSessionDateModal';

type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

interface SessionRowActionsProps {
    sessionId: string;
    substituteCoachName: string | null;
    currentStatus: SessionStatus;
    currentDate: string;
}

export default function SessionRowActions({
    sessionId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    substituteCoachName,
    currentStatus,
    currentDate,
}: SessionRowActionsProps) {
    const router = useRouter();
    const [isCancelling, startCancelTransition] = useTransition();
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isCancelled = currentStatus === 'CANCELLED';
    const cancelLabel = isCancelled ? 'Pulihkan' : 'Liburkan';
    const targetStatus: SessionStatus = isCancelled ? 'SCHEDULED' : 'CANCELLED';

    const handleCancel = () => {
        if (!isCancelled && !window.confirm('Apakah Anda yakin ingin meliburkan kelas ini?')) return;
        setErrorMessage(null);
        startCancelTransition(async () => {
            try {
                const response = await fetch(`/api/admin/sessions/${sessionId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: targetStatus }),
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    setErrorMessage(payload.error ?? 'Gagal mengubah status');
                    return;
                }
                router.refresh();
            } catch {
                setErrorMessage('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            <EditSessionDateModal
                sessionId={sessionId}
                currentDate={currentDate}
                isOpen={isRescheduling}
                onClose={() => setIsRescheduling(false)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                    type="button"
                    onClick={() => setIsRescheduling(true)}
                    disabled={isCancelling}
                    style={rescheduleButtonStyle}
                    title="Ubah Jadwal"
                >
                    <CalendarClock size={15} />
                    <span>Reschedule</span>
                </button>
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    style={{
                        ...cancelButtonStyle,
                        opacity: isCancelling ? 0.6 : 1,
                        background: isCancelled ? '#d0f5e0' : '#fee2e2',
                        color: isCancelled ? '#047857' : '#b91c1c',
                        borderColor: isCancelled ? '#bbf7d0' : '#fecaca'
                    }}
                    title={cancelLabel}
                >
                    {isCancelling ? (
                        <span>...</span>
                    ) : isCancelled ? (
                        <><RotateCcw size={15} /> Pulihkan</>
                    ) : (
                        <><CalendarX size={15} /> Liburkan</>
                    )}
                </button>
                {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
            </div>
        </>
    );
}

const rescheduleButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    background: '#fff',
    border: '1px solid #cbd5e1',
    color: '#334155',
    fontWeight: 500,
    transition: 'all 0.2s'
};

const cancelButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.85rem',
    borderRadius: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    fontWeight: 500,
    transition: 'all 0.2s'
};
