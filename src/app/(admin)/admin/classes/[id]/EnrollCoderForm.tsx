'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

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
      setErrorMessage('Select a coder to enroll');
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
          setErrorMessage(payload.error ?? 'Failed to enroll coder');
          return;
        }

        setMessage('Coder enrolled');
        setSelectedCoder('');
        router.refresh();
      } catch (error) {
        console.error('Enroll coder error', error);
        setErrorMessage('Unexpected error enrolling coder');
      }
    });
  };

  const disabled = coders.length === 0 || isPending;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <select
        value={selectedCoder}
        onChange={(event) => setSelectedCoder(event.target.value)}
        style={selectStyle}
        disabled={disabled}
      >
        <option value="">{coders.length === 0 ? 'All coders enrolled' : 'Select coder'}</option>
        {coders.map((coder) => (
          <option key={coder.id} value={coder.id}>
            {coder.full_name}
          </option>
        ))}
      </select>
      <button type="button" onClick={handleEnroll} style={buttonStyle} disabled={disabled}>
        {isPending ? 'Enrolling…' : 'Enroll'}
      </button>
      {message ? <span style={{ color: '#15803d', fontSize: '0.75rem' }}>{message}</span> : null}
      {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
    </div>
  );
}

const selectStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  fontSize: '0.9rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontSize: '0.85rem',
  cursor: 'pointer',
};
