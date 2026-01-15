'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function RequestConnectionButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const response = await fetch('/api/admin/whatsapp/connect', { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        window.alert(payload.error ?? 'Failed to request connection');
        return;
      }
      router.refresh();
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
        border: 'none',
        background: '#1e3a5f',
        color: '#fff',
        fontWeight: 600,
        cursor: 'pointer',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {isPending ? 'Requesting…' : 'Request Connection'}
    </button>
  );
}
