'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type RequestLeaveButtonProps = {
  sessionId: string;
  disabled?: boolean;
};

export default function RequestLeaveButton({ sessionId, disabled }: RequestLeaveButtonProps) {
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const submit = () => {
    setStatusMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/coach/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, note }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal mengirim pengajuan');
          return;
        }

        setStatusMessage('Pengajuan terkirim');
        setNote('');
        router.refresh();
      } catch (error) {
        console.error('Leave request failed', error);
        setErrorMessage('Terjadi kesalahan saat mengirim pengajuan');
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
      <input
        type="text"
        placeholder="Catatan singkat (opsional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        disabled={disabled || isPending}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || isPending}
        style={buttonStyle(disabled || isPending)}
      >
        {isPending ? 'Mengirim…' : disabled ? 'Sudah diajukan' : 'Ajukan Izin'}
      </button>
      {statusMessage ? <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>{statusMessage}</span> : null}
      {errorMessage ? <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{errorMessage}</span> : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: '0.45rem 0.6rem',
  borderRadius: '0.5rem',
  border: `1px solid var(--color-border)`,
  fontSize: '0.85rem',
  minWidth: '220px',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
};

const buttonStyle = (disabled: boolean): CSSProperties => ({
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: disabled ? 'rgba(15, 23, 42, 0.12)' : 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});
