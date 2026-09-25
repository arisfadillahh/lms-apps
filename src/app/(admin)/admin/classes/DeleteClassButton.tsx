'use client';

import { useState, useTransition } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';

type DeleteClassButtonProps = {
  classId: string;
  className: string;
};

export default function DeleteClassButton({ classId, className }: DeleteClassButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBlockedByPayment, setIsBlockedByPayment] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isPending) {
      return;
    }

    const confirmationName = window.prompt(
      `Hapus kelas "${className}"?\n\nSemua sesi, block, enrollment, presensi, dan penilaian kelas akan terhapus permanen. Riwayat pembayaran tetap disimpan.\n\nKetik nama kelas untuk melanjutkan:`,
    );
    if (confirmationName === null) {
      return;
    }
    if (confirmationName.trim() !== className.trim()) {
      setErrorMessage('Nama kelas tidak cocok. Penghapusan dibatalkan.');
      return;
    }

    setErrorMessage(null);
    setIsBlockedByPayment(false);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${classId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmationName }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (response.status === 409) {
            setIsBlockedByPayment(true);
          }
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
        disabled={isPending || isBlockedByPayment}
        style={{
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #dc2626',
          background: '#fef2f2',
          color: '#b91c1c',
          fontSize: '0.8rem',
          cursor: isPending || isBlockedByPayment ? 'not-allowed' : 'pointer',
          opacity: isPending || isBlockedByPayment ? 0.6 : 1,
        }}
      >
        {isPending ? 'Memproses…' : isBlockedByPayment ? 'Tidak dapat dihapus' : 'Hapus kelas'}
      </button>
      {errorMessage ? (
        <div style={{ color: '#b91c1c', fontSize: 12, lineHeight: 1.4, maxWidth: 320 }}>
          <div>{errorMessage}</div>
          {isBlockedByPayment ? (
            <a href="/admin/payments/coders" style={{ display: 'inline-block', marginTop: 4, color: '#1d4ed8', textDecoration: 'underline' }}>
              Buka Pembayaran Coder untuk menyelesaikan periode ini
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
