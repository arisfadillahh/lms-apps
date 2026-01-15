'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Upload } from 'lucide-react';

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
        setErrorMessage(payload.error ?? 'Gagal upload materi');
        return;
      }

      setStatusMessage('Berhasil diupload');
      router.refresh();
      reset();
      setTimeout(() => setStatusMessage(null), 3000);
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem 1.5rem',
        alignItems: 'end',
      }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle}>Judul Materi</label>
        <input type="text" style={inputStyle} placeholder="Contoh: Slide Modul 1" required {...register('title')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Deskripsi (Opsional)</label>
        <input type="text" style={inputStyle} placeholder="Keterangan singkat" {...register('description')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Link File (URL)</label>
        <input type="url" style={inputStyle} placeholder="https://drive.google.com/..." {...register('fileUrl')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Catatan Coach</label>
        <input type="text" style={inputStyle} placeholder="Catatan khusus untuk coach lain" {...register('coachNote')} />
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Tampilkan Mulai Sesi</label>
        <select style={selectStyle} {...register('visibleFromSessionId')}>
          <option value="">Langsung Tampilkan</option>
          {sessions.map((sessionItem) => (
            <option key={sessionItem.id} value={sessionItem.id}>
              {new Date(sessionItem.date_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            ...buttonStyle,
            opacity: isPending ? 0.7 : 1,
            cursor: isPending ? 'wait' : 'pointer'
          }}
        >
          <Upload size={16} />
          {isPending ? 'Menyimpan...' : 'Upload Materi'}
        </button>
        {statusMessage ? <span style={{ color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>✓ {statusMessage}</span> : null}
        {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>! {errorMessage}</span> : null}
      </div>
    </form>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#475569',
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  padding: '0.6rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '0.9rem',
  outline: 'none',
  transition: 'border 0.2s',
  width: '100%'
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  background: '#fff'
};

const buttonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  boxShadow: '0 2px 4px rgba(30, 58, 95, 0.15)',
  transition: 'transform 0.1s'
};
