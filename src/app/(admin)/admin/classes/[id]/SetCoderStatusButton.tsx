'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserCheck, UserX } from 'lucide-react';

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

  const title = targetStatus === 'INACTIVE' ? 'Nonaktifkan Siswa' : 'Aktifkan Siswa';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        title={title}
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: '1px solid #f97316',
          background: '#fff7ed',
          color: '#c2410c',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled || isPending ? 0.6 : 1,
          transition: 'all 0.2s',
        }}
      >
        {targetStatus === 'INACTIVE' ? <UserX size={16} /> : <UserCheck size={16} />}
      </button>
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.65rem', maxWidth: '80px', textAlign: 'center' }}>Errors</span> : null}
    </div>
  );
}
