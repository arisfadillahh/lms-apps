'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

type SetCoderStatusButtonProps = {
  classId: string;
  coderId: string;
  targetStatus: 'ACTIVE' | 'INACTIVE';
  disabled?: boolean;
};

export default function SetCoderStatusButton({ classId, coderId, targetStatus, disabled }: SetCoderStatusButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const label = targetStatus === 'INACTIVE' ? 'Inactive' : 'Activate';

  const handleClick = () => {
    if (disabled || isPending) {
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${classId}/enroll`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coderId, status: targetStatus }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal memperbarui status');
          return;
        }
        router.refresh();
      } catch (error) {
        console.error('Failed to update enrollment status', error);
        setErrorMessage('Terjadi kesalahan tak terduga');
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        style={{
          padding: '0.3rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #f97316',
          background: '#fff7ed',
          color: '#c2410c',
          fontSize: '0.8rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled || isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Menyimpan…' : label}
      </button>
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
    </div>
  );
}
