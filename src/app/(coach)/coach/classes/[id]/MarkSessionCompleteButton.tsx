'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

interface MarkSessionCompleteButtonProps {
  sessionId: string;
}

export default function MarkSessionCompleteButton({ sessionId }: MarkSessionCompleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!window.confirm('Tandai kelas ini sebagai selesai?')) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/coach/sessions/${sessionId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED' }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          window.alert(payload.error ?? 'Gagal mengubah status sesi');
          return;
        }
        router.refresh();
      } catch (error) {
        console.error('Failed to update session status', error);
        window.alert('Terjadi kesalahan');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        border: 'none',
        background: '#16a34a',
        color: '#ffffff',
        fontSize: '0.9rem',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
        transition: 'all 0.2s'
      }}
    >
      <CheckCircle size={16} />
      {isPending ? 'Menyelesaikan…' : 'Selesai Kelas'}
    </button>
  );
}
