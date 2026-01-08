'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type DeleteLevelButtonProps = {
  levelId: string;
  levelName: string;
};

export default function DeleteLevelButton({ levelId, levelName }: DeleteLevelButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onDelete = () => {
    setErrorMessage(null);

    if (!window.confirm(`Hapus level "${levelName}"? Semua block dan lesson template di dalamnya akan ikut terhapus.`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/admin/curriculum/levels/${encodeURIComponent(levelId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Gagal menghapus level');
        return;
      }

      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
      <button type="button" onClick={onDelete} disabled={isPending} style={deleteButtonStyle}>
        {isPending ? 'Menghapus…' : 'Hapus Level'}
      </button>
      {errorMessage ? <span style={errorTextStyle}>{errorMessage}</span> : null}
    </div>
  );
}

const deleteButtonStyle: CSSProperties = {
  padding: '0.45rem 0.9rem',
  borderRadius: '0.6rem',
  border: '1px solid rgba(248, 113, 113, 0.45)',
  background: 'rgba(248, 113, 113, 0.12)',
  color: '#b91c1c',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const errorTextStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#b91c1c',
};
