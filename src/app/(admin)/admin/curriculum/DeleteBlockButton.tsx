"use client";

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

type DeleteBlockButtonProps = {
  blockId: string;
  blockName: string;
};

export default function DeleteBlockButton({ blockId, blockName }: DeleteBlockButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (!window.confirm(`Hapus block "${blockName}" beserta lesson-nya?`)) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/admin/curriculum/blocks/${blockId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? 'Gagal menghapus block');
        return;
      }

      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <button type="button" onClick={handleDelete} style={deleteButtonStyle} disabled={isPending}>
        🗑️ Hapus Block
      </button>
      {error ? <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{error}</span> : null}
    </div>
  );
}

const deleteButtonStyle: CSSProperties = {
  padding: '0.5rem 0.8rem',
  borderRadius: '0.5rem',
  border: '1px solid rgba(248, 113, 113, 0.5)',
  background: 'rgba(248, 113, 113, 0.12)',
  color: '#b91c1c',
  fontWeight: 600,
  cursor: 'pointer',
};
