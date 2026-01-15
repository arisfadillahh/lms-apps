'use client';

import type { CSSProperties, ChangeEventHandler } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type LessonExampleUploaderProps = {
  endpoint: string;
  currentUrl: string | null;
  label?: string;
  emptyHint?: string;
  uploadSuccessMessage?: string;
  deleteSuccessMessage?: string;
};

export default function LessonExampleUploader({
  endpoint,
  currentUrl,
  label = 'Contoh Game',
  emptyHint = 'Belum ada file yang diunggah.',
  uploadSuccessMessage = 'Contoh game diperbarui',
  deleteSuccessMessage = 'Contoh game dihapus',
}: LessonExampleUploaderProps) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null;
    setFileName(file?.name ?? '');
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const upload = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement | null;

    if (!fileInput?.files || fileInput.files.length === 0) {
      setErrorMessage('Pilih file terlebih dahulu.');
      return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setStatusMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Gagal mengunggah contoh game');
        return;
      }

      setStatusMessage(uploadSuccessMessage);
      setFileName('');
      form.reset();
      router.refresh();
    });
  };

  const remove = () => {
    setStatusMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Gagal menghapus contoh game');
        return;
      }

      setStatusMessage(deleteSuccessMessage);
      router.refresh();
    });
  };

  return (
    <form onSubmit={upload} style={formStyle}>
      <div style={rowStyle}>
        <label style={labelStyle}>{label}</label>
        <input type="file" name="file" onChange={handleChange} disabled={isPending} />
        {fileName ? <span style={hintStyle}>{fileName}</span> : null}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="submit" disabled={isPending} style={primaryButton}>
            {isPending ? 'Mengunggah…' : 'Unggah / Ganti'}
          </button>
          {currentUrl ? (
            <button type="button" onClick={remove} style={dangerButton} disabled={isPending}>
              Hapus file
            </button>
          ) : null}
        </div>
        {currentUrl ? (
          <a href={currentUrl} target="_blank" rel="noreferrer" style={linkStyle}>
            Lihat file saat ini
          </a>
        ) : (
          <span style={mutedStyle}>{emptyHint}</span>
        )}
        {statusMessage ? <span style={successStyle}>{statusMessage}</span> : null}
        {errorMessage ? <span style={errorStyle}>{errorMessage}</span> : null}
      </div>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#0f172a',
};

const hintStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#475569',
};

const linkStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#1e3a5f',
  fontWeight: 600,
};

const mutedStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#94a3b8',
};

const successStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#16a34a',
};

const errorStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#b91c1c',
};

const primaryButton: CSSProperties = {
  padding: '0.35rem 0.75rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const dangerButton: CSSProperties = {
  padding: '0.35rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid rgba(248, 113, 113, 0.6)',
  background: 'rgba(248, 113, 113, 0.12)',
  color: '#b91c1c',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
};
