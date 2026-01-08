'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface MarkSessionCompleteButtonProps {
  sessionId: string;
}

export default function MarkSessionCompleteButton({ sessionId }: MarkSessionCompleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/coach/sessions/${sessionId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED' }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          window.alert(payload.error ?? 'Failed to update session status');
          return;
        }
        router.refresh();
      } catch (error) {
        console.error('Failed to update session status', error);
        window.alert('Unexpected error updating session status');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-success)',
        background: 'rgba(22, 163, 74, 0.12)',
        color: 'var(--color-success)',
        fontSize: '0.9rem',
        fontWeight: 600,
        cursor: 'pointer',
        opacity: isPending ? 0.7 : 1,
      }}
    >
      {isPending ? 'Menyelesaikan…' : 'Kelas selesai'}
    </button>
  );
}
