
'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

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
    substituteCoachName,
    currentStatus,
    currentDate,
}: SessionRowActionsProps) {
    const router = useRouter();
    const [isCancelling, startCancelTransition] = useTransition();
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isCancelled = currentStatus === 'CANCELLED';
    const cancelLabel = isCancelled ? 'Pulihkan' : 'Liburkan Kelas';
    const targetStatus: SessionStatus = isCancelled ? 'SCHEDULED' : 'CANCELLED';

    const handleCancel = () => {
        if (!isCancelled && !window.confirm('Liburkan kelas ini?')) return;
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
                    setErrorMessage(payload.error ?? 'Failed');
                    return;
                }
                router.refresh();
            } catch {
                setErrorMessage('Error');
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
                >
                    Reschedule
                </button>
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    style={{ ...cancelButtonStyle, opacity: isCancelling ? 0.6 : 1 }}
                >
                    {isCancelling ? '...' : cancelLabel}
                </button>
                {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
            </div>
        </>
    );
}

const rescheduleButtonStyle: CSSProperties = {
    padding: '0.45rem 0.85rem',
    borderRadius: '0.5rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    background: '#fff',
    border: '1px solid #cbd5e1',
    color: '#334155',
};

const cancelButtonStyle: CSSProperties = {
    padding: '0.45rem 0.85rem',
    borderRadius: '0.5rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#0f172a',
};
