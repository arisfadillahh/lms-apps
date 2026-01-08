'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

type RemoveCoderButtonProps = {
  classId: string;
  coderId: string;
  disabled?: boolean;
};

export default function RemoveCoderButton({ classId, coderId, disabled }: RemoveCoderButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    if (disabled || isPending) {
      return;
    }
    if (
      !window.confirm(
        'Hapus coder ini dari kelas? Setelah dihapus, coder tidak bisa lagi mengakses materi dan riwayat kelas ini.',
      )
    ) {
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${classId}/enroll`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coderId }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal menghapus coder');
          return;
        }
        router.refresh();
      } catch (error) {
        console.error('Failed to remove coder', error);
        setErrorMessage('Terjadi kesalahan tak terduga');
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button
        type="button"
        onClick={handleRemove}
        disabled={disabled || isPending}
        style={{
          padding: '0.35rem 0.8rem',
          borderRadius: '0.5rem',
          border: '1px solid #dc2626',
          background: '#fef2f2',
          color: '#b91c1c',
          fontSize: '0.8rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled || isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Menghapus…' : 'Remove'}
      </button>
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
    </div>
  );
}
