'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';

interface MakeUpUploadFormProps {
  taskId: string;
}

export default function MakeUpUploadForm({ taskId }: MakeUpUploadFormProps) {
  const [filesText, setFilesText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setStatusMessage(null);
    setErrorMessage(null);

    const urls = filesText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (urls.length === 0) {
      setErrorMessage('Provide at least one file URL');
      return;
    }

    const files = urls.map((url, index) => ({ name: `File ${index + 1}`, url }));

    startTransition(async () => {
      const response = await fetch(`/api/coder/makeup/${taskId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to upload files');
        return;
      }

      setStatusMessage('Uploaded! Coach will review soon.');
      setFilesText('');
    });
  };

  return (
    <div style={formStyle}>
      <textarea
        value={filesText}
        onChange={(event) => setFilesText(event.target.value)}
        placeholder="Paste file URLs, one per line"
        style={textareaStyle}
        rows={4}
      />
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        style={buttonStyle}
      >
        {isPending ? 'Uploading…' : 'Upload'}
      </button>
      {statusMessage ? <span style={{ color: '#15803d', fontSize: '0.85rem' }}>{statusMessage}</span> : null}
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{errorMessage}</span> : null}
    </div>
  );
}

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  maxWidth: '320px',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  padding: '0.65rem 0.75rem',
  fontSize: '0.9rem',
  resize: 'vertical',
};

const buttonStyle: CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
