'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';

import type { UserRecord } from '@/lib/dao/usersDao';

interface EnrollCoderFormProps {
  classId: string;
  coders: UserRecord[];
}

export default function EnrollCoderForm({ classId, coders }: EnrollCoderFormProps) {
  const router = useRouter();
  const [selectedCoder, setSelectedCoder] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleEnroll = () => {
    if (!selectedCoder) {
      setErrorMessage('Pilih coder terlebih dahulu');
      return;
    }

    setErrorMessage(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${classId}/enroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coderId: selectedCoder }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal mendaftarkan coder');
          return;
        }

        setMessage('Berhasil didaftarkan');
        setSelectedCoder('');
        router.refresh();

        // Auto clear success message
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Enroll coder error', error);
        setErrorMessage('Terjadi kesalahan saat mendaftar');
      }
    });
  };

  const disabled = coders.length === 0 || isPending;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <select
        value={selectedCoder}
        onChange={(event) => setSelectedCoder(event.target.value)}
        style={selectStyle}
        disabled={disabled}
      >
        <option value="">{coders.length === 0 ? 'Semua coder sudah terdaftar' : 'Pilih Coder...'}</option>
        {coders.map((coder) => (
          <option key={coder.id} value={coder.id}>
            {coder.full_name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleEnroll}
        style={{
          ...buttonStyle,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
        disabled={disabled}
      >
        <UserPlus size={16} />
        {isPending ? 'Mendaftarkan...' : 'Tambah Coder'}
      </button>

      {message ? <span style={{ color: '#15803d', fontSize: '0.8rem', fontWeight: 500 }}>✓ {message}</span> : null}
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.8rem', fontWeight: 500 }}>! {errorMessage}</span> : null}
    </div>
  );
}

const selectStyle: CSSProperties = {
  padding: '0.6rem 1rem',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  fontSize: '0.9rem',
  outline: 'none',
  background: '#f8fafc',
  minWidth: '200px',
  cursor: 'pointer'
};

const buttonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.6rem 1rem',
  borderRadius: '10px',
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 600,
  transition: 'background 0.2s',
  boxShadow: '0 2px 4px rgba(30, 58, 95, 0.2)'
};
