'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

type CancelSessionButtonProps = {
  sessionId: string;
  currentStatus: SessionStatus;
};

const cancelButtonStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#0f172a',
  fontSize: '0.8rem',
  cursor: 'pointer',
};

export default function CancelSessionButton({ sessionId, currentStatus }: CancelSessionButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCancelled = currentStatus === 'CANCELLED';
  const targetStatus: SessionStatus = isCancelled ? 'SCHEDULED' : 'CANCELLED';
  const label = isCancelled ? 'Pulihkan Sesi' : 'Liburkan Sesi';

  const handleUpdate = async () => {
    if (!isCancelled && !window.confirm('Liburkan sesi ini? Coach dan coder akan melihat status CANCELLED.')) {
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/sessions/${sessionId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal memperbarui status sesi');
          return;
        }
        router.refresh();
      } catch (error) {
        console.error('Failed to update session status', error);
        setErrorMessage('Terjadi kesalahan tak terduga');
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button type="button" disabled={isPending} onClick={handleUpdate} style={{ ...cancelButtonStyle, opacity: isPending ? 0.6 : 1 }}>
        {isPending ? 'Menyimpan…' : label}
      </button>
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
    </div>
  );
}
