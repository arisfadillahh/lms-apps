'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ToggleActiveButtonProps = {
  userId: string;
  initialActive: boolean;
};

export default function ToggleActiveButton({ userId, initialActive }: ToggleActiveButtonProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggle = (nextActive: boolean) => {
    if (nextActive === isActive) {
      return;
    }

    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: nextActive }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Failed to update status');
          return;
        }

        setIsActive(nextActive);
        setMessage(nextActive ? 'Activated' : 'Deactivated');
        router.refresh();
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Failed to toggle user status', error);
        setErrorMessage('Unexpected error updating status');
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <button
        type="button"
        onClick={() => handleToggle(!isActive)}
        disabled={isPending}
        style={{
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid',
          borderColor: isActive ? '#b91c1c' : '#16a34a',
          background: isActive ? '#fef2f2' : '#ecfdf3',
          color: isActive ? '#b91c1c' : '#16a34a',
          fontSize: '0.85rem',
          cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isActive ? 'Deactivate' : 'Activate'}
      </button>
      {message ? <span style={{ fontSize: '0.75rem', color: '#15803d' }}>{message}</span> : null}
      {errorMessage ? <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{errorMessage}</span> : null}
    </div>
  );
}
