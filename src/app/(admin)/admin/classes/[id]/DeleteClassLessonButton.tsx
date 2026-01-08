'use client';

import type { CSSProperties } from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

type DeleteClassLessonButtonProps = {
  lessonId: string;
  lessonTitle: string;
};

export default function DeleteClassLessonButton({ lessonId, lessonTitle }: DeleteClassLessonButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    if (!window.confirm(`Hapus lesson "${lessonTitle}" dari kelas?`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/admin/class-lessons/${lessonId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        window.alert(payload.error ?? 'Gagal menghapus lesson');
        return;
      }

      router.refresh();
    });
  };

  return (
    <button type="button" onClick={onDelete} disabled={isPending} style={deleteButtonStyle}>
      {isPending ? 'Menghapus…' : 'Hapus Lesson'}
    </button>
  );
}

const deleteButtonStyle: CSSProperties = {
  padding: '0.3rem 0.7rem',
  borderRadius: '0.5rem',
  border: '1px solid rgba(248, 113, 113, 0.35)',
  background: 'rgba(248, 113, 113, 0.12)',
  color: '#b91c1c',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
