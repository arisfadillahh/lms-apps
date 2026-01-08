'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type DeleteClassButtonProps = {
  classId: string;
  className: string;
};

export default function DeleteClassButton({ classId, className }: DeleteClassButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (isPending) {
      return;
    }
    const confirmed = window.confirm(`Hapus kelas "${className}"? Semua sesi, block, dan enrollment akan ikut terhapus permanen.`);
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${classId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal menghapus kelas');
          return;
        }
        router.refresh();
      } catch (error) {
        console.error('Failed to delete class', error);
        setErrorMessage('Terjadi kesalahan tak terduga');
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        style={{
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #dc2626',
          background: '#fef2f2',
          color: '#b91c1c',
          fontSize: '0.8rem',
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Menghapus…' : 'Delete'}
      </button>
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: 12 }}>{errorMessage}</span> : null}
    </div>
  );
}
