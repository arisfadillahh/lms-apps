"use client";

import { useState, useTransition, type CSSProperties, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type SessionOption = {
  id: string;
  label: string;
};

type ManualLessonAssignFormProps = {
  sessionOptions: SessionOption[];
  blockOptions: Array<{
    id: string;
    label: string;
    lessons: Array<{
      id: string;
      title: string;
      status: string;
    }>;
  }>;
};

export default function ManualLessonAssignForm({ sessionOptions, blockOptions }: ManualLessonAssignFormProps) {
  const router = useRouter();
  const [selectedSession, setSelectedSession] = useState(sessionOptions[0]?.id ?? '');
  const [selectedBlock, setSelectedBlock] = useState(blockOptions[0]?.id ?? '');
  const initialLesson = blockOptions.find((option) => option.id === selectedBlock)?.lessons[0]?.id ?? '';
  const [selectedLesson, setSelectedLesson] = useState(initialLesson);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeBlock = blockOptions.find((option) => option.id === selectedBlock);
  const lessonOptions = activeBlock?.lessons ?? [];

  const handleBlockChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const blockId = event.target.value;
    setSelectedBlock(blockId);
    const firstLesson = blockOptions.find((option) => option.id === blockId)?.lessons[0]?.id ?? '';
    setSelectedLesson(firstLesson);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSession || !selectedBlock || !selectedLesson) {
      setError('Pilih sesi, block, dan lesson');
      return;
    }
    startTransition(async () => {
      setStatus(null);
      setError(null);
      try {
        const response = await fetch('/api/admin/class-lessons/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: selectedSession,
            lessonId: selectedLesson,
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? 'Gagal mengatur lesson');
        }

        setStatus('Lesson berhasil dipasangkan ke sesi.');
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal mengatur lesson';
        setError(message);
      }
    });
  };

  const disabled = isPending || sessionOptions.length === 0 || blockOptions.length === 0 || lessonOptions.length === 0;

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <label style={labelStyle}>
        Pilih sesi
        <select
          value={selectedSession}
          onChange={(event) => setSelectedSession(event.target.value)}
          style={selectStyle}
          disabled={isPending || sessionOptions.length === 0}
        >
          {sessionOptions.length === 0 ? <option>Semua sesi sudah selesai</option> : null}
          {sessionOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <label style={labelStyle}>
          Pilih block
          <select
            value={selectedBlock}
            onChange={handleBlockChange}
            style={selectStyle}
            disabled={isPending || blockOptions.length === 0}
          >
            {blockOptions.length === 0 ? <option>Belum ada block</option> : null}
            {blockOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          Pilih lesson
          <select
            value={selectedLesson}
            onChange={(event) => setSelectedLesson(event.target.value)}
            style={selectStyle}
            disabled={isPending || lessonOptions.length === 0}
          >
            {lessonOptions.length === 0 ? <option>Belum ada lesson</option> : null}
            {lessonOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title} ({option.status})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <button type="submit" disabled={disabled} style={buttonStyle(disabled)}>
          {isPending ? 'Mengatur…' : 'Pasangkan Lesson'}
        </button>
        {status ? <span style={{ color: '#15803d', fontSize: '0.85rem' }}>{status}</span> : null}
        {error ? <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{error}</span> : null}
      </div>
    </form>
  );
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.85rem',
  color: '#475569',
  fontWeight: 500,
};

const selectStyle: CSSProperties = {
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  padding: '0.5rem 0.65rem',
  fontSize: '0.9rem',
  background: '#ffffff',
};

const buttonStyle = (disabled: boolean): CSSProperties => ({
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.6rem 0.9rem',
  background: disabled ? '#cbd5f5' : '#2563eb',
  color: '#ffffff',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
