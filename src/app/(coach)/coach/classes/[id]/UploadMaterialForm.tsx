'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

interface UploadMaterialFormProps {
  classId: string;
  sessions: { id: string; date_time: string }[];
  defaultSessionId?: string;
}

type FormValues = {
  title: string;
  description?: string;
  fileUrl?: string;
  coachNote?: string;
  visibleFromSessionId?: string;
};

export default function UploadMaterialForm({ classId, sessions, defaultSessionId }: UploadMaterialFormProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      fileUrl: '',
      coachNote: '',
      visibleFromSessionId: defaultSessionId || '',
    },
  });

  const onSubmit = (values: FormValues) => {
    setStatusMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/coach/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          title: values.title,
          description: values.description || undefined,
          fileUrl: values.fileUrl || undefined,
          coachNote: values.coachNote || undefined,
          visibleFromSessionId: values.visibleFromSessionId || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to upload material');
        return;
      }

      setStatusMessage('Material uploaded');
      router.refresh();
      reset();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem 1.25rem',
        alignItems: 'end',
      }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle}>Title</label>
        <input type="text" style={inputStyle} required {...register('title')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Description</label>
        <input type="text" style={inputStyle} {...register('description')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>File URL</label>
        <input type="url" style={inputStyle} placeholder="https://..." {...register('fileUrl')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Coach Note</label>
        <input type="text" style={inputStyle} {...register('coachNote')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Visible From Session</label>
        <select style={inputStyle} {...register('visibleFromSessionId')}>
          <option value="">Immediately</option>
          {sessions.map((sessionItem) => (
            <option key={sessionItem.id} value={sessionItem.id}>
              {new Date(sessionItem.date_time).toLocaleString()}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#1e3a5f',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Uploading…' : 'Add Material'}
        </button>
        {statusMessage ? <span style={{ color: '#15803d', fontSize: '0.85rem' }}>{statusMessage}</span> : null}
        {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{errorMessage}</span> : null}
      </div>
    </form>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.9rem',
  color: '#1f2937',
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  fontSize: '0.95rem',
};
