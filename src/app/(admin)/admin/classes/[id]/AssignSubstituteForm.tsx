'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';

import type { UserRecord } from '@/lib/dao/usersDao';

interface AssignSubstituteFormProps {
  sessionId: string;
  coaches: UserRecord[];
  currentSubstituteId: string | null;
}

export default function AssignSubstituteForm({ sessionId, coaches, currentSubstituteId }: AssignSubstituteFormProps) {
  const [value, setValue] = useState<string>(currentSubstituteId ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/sessions/${sessionId}/substitute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ substituteCoachId: value || null }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Failed to assign substitute');
          return;
        }

        setMessage('Saved');
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Assign substitute error', error);
        setErrorMessage('Unexpected error');
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        style={selectStyle}
        disabled={isPending}
      >
        <option value="">None</option>
        {coaches.map((coach) => (
          <option key={coach.id} value={coach.id}>
            {coach.full_name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSubmit}
        style={buttonStyle}
        disabled={isPending}
      >
        {isPending ? 'Saving…' : 'Save'}
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
  background: '#2563eb',
  color: '#fff',
  fontSize: '0.85rem',
  cursor: 'pointer',
};
