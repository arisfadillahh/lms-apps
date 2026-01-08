'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type TaskItem = {
  id: string;
  coderName: string;
  className: string;
  dueDate: string;
  status: 'PENDING_UPLOAD' | 'SUBMITTED' | 'REVIEWED';
  submittedAt: string | null | undefined;
  instructions?: string | null;
  sessionDate?: string | null;
  feedback?: string | null;
  submissionFiles?: unknown;
};

type MakeUpTaskListProps = {
  tasks: TaskItem[];
};

export default function MakeUpTaskList({ tasks }: MakeUpTaskListProps) {
  const router = useRouter();
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitReview = (taskId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const feedback = feedbackMap[taskId]?.trim();

    startTransition(async () => {
      try {
        const response = await fetch(`/api/coach/makeup/${taskId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'REVIEWED', feedback }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal menyimpan review');
          return;
        }

        setSuccessMessage('Tugas sudah ditandai reviewed.');
        router.refresh();
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (error) {
        console.error('Review make-up task error', error);
        setErrorMessage('Terjadi kesalahan saat mengirim review');
      }
    });
  };

  const renderSubmissionFiles = (submissionFiles: unknown) => {
    if (!submissionFiles) {
      return <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Tidak ada file.</span>;
    }

    if (Array.isArray(submissionFiles)) {
      const items = submissionFiles as Array<{ name?: string; url?: string }>;
      if (items.length === 0) {
        return <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Tidak ada file.</span>;
      }
      return (
        <ul style={{ margin: 0, paddingLeft: '1rem', color: 'var(--color-accent)', fontSize: '0.85rem' }}>
          {items.map((file, index) => (
            <li key={`${file.url ?? index}`}>
              {file.url ? (
                <a href={file.url} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>
                  {file.name ?? `File ${index + 1}`}
                </a>
              ) : (
                file.name ?? `File ${index + 1}`
              )}
            </li>
          ))}
        </ul>
      );
    }

    if (typeof submissionFiles === 'object') {
      const record = submissionFiles as Record<string, unknown>;
      return (
        <pre style={{ fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.05)', padding: '0.5rem', borderRadius: '0.5rem' }}>
          {JSON.stringify(record, null, 2)}
        </pre>
      );
    }

    return <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{String(submissionFiles)}</span>;
  };

  return (
    <section style={containerStyle}>
      {errorMessage ? <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>{errorMessage}</p> : null}
      {successMessage ? <p style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>{successMessage}</p> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tasks.map((task) => (
          <div key={task.id} style={cardStyle}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.1rem' }}>{task.className}</p>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{task.coderName}</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Sesi: {task.sessionDate ? new Date(task.sessionDate).toLocaleString() : '—'}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Batas pengumpulan:{' '}
                <strong>{task.dueDate ? new Date(task.dueDate).toLocaleString() : '—'}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: statusColor(task.status) }}>Status: {task.status}</p>
              {task.instructions ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>Instruksi: {task.instructions}</p>
              ) : null}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {task.status === 'SUBMITTED' ? (
                <>
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>File yang dikirim:</p>
                    {renderSubmissionFiles(task.submissionFiles)}
                  </div>
                  <textarea
                    value={feedbackMap[task.id] ?? task.feedback ?? ''}
                    onChange={(event) =>
                      setFeedbackMap((prev) => ({
                        ...prev,
                        [task.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    placeholder="Catatan feedback untuk coder (opsional)"
                    style={textareaStyle}
                  />
                  <button
                    type="button"
                    onClick={() => submitReview(task.id)}
                    disabled={isPending}
                    style={buttonStyle}
                  >
                    {isPending ? 'Menyimpan…' : 'Tandai Reviewed'}
                  </button>
                </>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  Menunggu unggahan coder. Kamu akan dapat meninjau setelah status berubah menjadi SUBMITTED.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function statusColor(status: TaskItem['status']): string {
  switch (status) {
    case 'SUBMITTED':
      return 'var(--color-accent)';
    case 'REVIEWED':
      return 'var(--color-success)';
    default:
      return 'var(--color-danger)';
  }
}

const containerStyle: CSSProperties = {
  background: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-lg)',
  border: `1px solid var(--color-border)`,
  padding: '1.25rem 1.5rem',
  boxShadow: 'var(--shadow-medium)',
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
  border: `1px solid var(--color-border)`,
  borderRadius: 'var(--radius-lg)',
  padding: '1rem 1.25rem',
  background: 'rgba(37, 99, 235, 0.04)',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: '0.5rem',
  border: `1px solid var(--color-border)`,
  padding: '0.55rem 0.7rem',
  fontSize: '0.9rem',
  resize: 'vertical',
  color: 'var(--color-text-primary)',
  background: 'var(--color-bg-surface)',
};

const buttonStyle: CSSProperties = {
  padding: '0.55rem 1.1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
