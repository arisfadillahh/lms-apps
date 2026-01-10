'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type EkskulCompetencyEditorProps = {
  sessionId: string;
  sessionDate: string;
  initialCompetencies: string[];
};

export default function EkskulCompetencyEditor({ sessionId, sessionDate, initialCompetencies }: EkskulCompetencyEditorProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialCompetencies.join('\n'));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialCompetencies.join('\n'));
  }, [initialCompetencies.join('|')]);

  const save = () => {
    setStatusMessage(null);
    setErrorMessage(null);

    const lines = value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      setErrorMessage('Minimal satu kompetensi diperlukan.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/exkul/competencies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, competencies: lines }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal menyimpan kompetensi');
          return;
        }

        setStatusMessage('Tersimpan');
        router.refresh();
        setTimeout(() => setStatusMessage(null), 2500);
      } catch (error) {
        console.error('Save competencies error', error);
        setErrorMessage('Terjadi kesalahan saat menyimpan');
      }
    });
  };

  return (
    <div style={containerStyle}>
      <div>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.35rem' }}>
          {new Date(sessionDate).toLocaleString()}
        </p>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={3}
          placeholder={'Masukkan satu kompetensi per baris'}
          style={textareaStyle}
          disabled={isPending}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button type="button" onClick={save} disabled={isPending} style={buttonStyle}>
          {isPending ? 'Menyimpan…' : 'Simpan'}
        </button>
        {statusMessage ? <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>{statusMessage}</span> : null}
        {errorMessage ? <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{errorMessage}</span> : null}
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  border: `1px solid var(--color-border)`,
  borderRadius: 'var(--radius-lg)',
  padding: '0.95rem 1.1rem',
  background: 'var(--color-bg-surface)',
  boxShadow: 'var(--shadow-medium)',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: '0.5rem',
  border: `1px solid var(--color-border)`,
  padding: '0.65rem 0.8rem',
  fontSize: '0.9rem',
  resize: 'vertical',
  color: 'var(--color-text-primary)',
  background: 'var(--color-bg-surface)',
};

const buttonStyle: CSSProperties = {
  padding: '0.5rem 1.1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
