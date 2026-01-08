'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type InstantiateTemplateLessonButtonProps = {
  classId: string;
  classBlockId: string;
  lessonTemplateId: string;
};

export default function InstantiateTemplateLessonButton({
  classId,
  classBlockId,
  lessonTemplateId,
}: InstantiateTemplateLessonButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleClick = () => {
    setStatusMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/classes/${classId}/blocks/${classBlockId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonTemplateId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setStatusMessage(payload.error ?? 'Gagal menyalin lesson ke kelas');
        return;
      }

      setStatusMessage('Lesson ditambahkan ke kelas');
      router.refresh();
      setTimeout(() => setStatusMessage(null), 3000);
    });
  };

  return (
    <div style={containerStyle}>
      <button type="button" onClick={handleClick} disabled={isPending} style={buttonStyle}>
        {isPending ? 'Menyalin…' : 'Salin ke kelas'}
      </button>
      {statusMessage ? <span style={statusStyle}>{statusMessage}</span> : null}
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const buttonStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  borderRadius: '0.6rem',
  border: '1px solid rgba(37, 99, 235, 0.4)',
  background: '#2563eb',
  color: '#fff',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const statusStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#2563eb',
};
