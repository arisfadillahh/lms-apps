'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';

type ChangePasswordFormProps = {
  variant?: 'card' | 'sidebar';
};

export default function ChangePasswordForm({ variant = 'card' }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setStatusMessage(null);
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/coder/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to update password');
        return;
      }

      setStatusMessage('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
    });
  };

  return (
    <div style={formStyle}>
      <h3 style={headingStyle[variant]}>Change Password</h3>
      <label style={labelStyle[variant]}>
        Current Password
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          style={inputStyle[variant]}
        />
      </label>
      <label style={labelStyle[variant]}>
        New Password
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          style={inputStyle[variant]}
        />
      </label>
      <button type="button" onClick={submit} disabled={isPending} style={buttonStyle[variant]}>
        {isPending ? 'Updating…' : 'Update Password'}
      </button>
      {statusMessage ? <span style={statusStyle[variant]}>{statusMessage}</span> : null}
      {errorMessage ? <span style={errorStyle[variant]}>{errorMessage}</span> : null}
    </div>
  );
}

const formStyle: Record<'card' | 'sidebar', CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    background: '#ffffff',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
    color: '#0f172a',
    maxWidth: '360px',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
    background: 'rgba(15, 23, 42, 0.25)',
    borderRadius: '0.75rem',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    padding: '0.9rem 1rem',
    color: '#f8fafc',
  },
};

const headingStyle: Record<'card' | 'sidebar', CSSProperties> = {
  card: { fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' },
  sidebar: { fontSize: '1rem', fontWeight: 600, color: '#f8fafc' },
};

const labelStyle: Record<'card' | 'sidebar', CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    fontSize: '0.9rem',
    color: '#1f2937',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.35rem',
    fontSize: '0.85rem',
    color: '#e2e8f0',
  },
};

const inputStyle: Record<'card' | 'sidebar', CSSProperties> = {
  card: {
    padding: '0.6rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5f5',
    fontSize: '0.95rem',
  },
  sidebar: {
    padding: '0.55rem 0.7rem',
    borderRadius: '0.5rem',
    border: '1px solid rgba(191, 219, 254, 0.5)',
    background: 'rgba(15, 23, 42, 0.35)',
    color: '#f8fafc',
    fontSize: '0.9rem',
  },
};

const buttonStyle: Record<'card' | 'sidebar', CSSProperties> = {
  card: {
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  sidebar: {
    padding: '0.55rem 1.1rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#38bdf8',
    color: '#0f172a',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

const statusStyle: Record<'card' | 'sidebar', CSSProperties> = {
  card: { color: '#15803d', fontSize: '0.85rem' },
  sidebar: { color: '#c1f4ce', fontSize: '0.8rem' },
};

const errorStyle: Record<'card' | 'sidebar', CSSProperties> = {
  card: { color: '#b91c1c', fontSize: '0.85rem' },
  sidebar: { color: '#fee2e2', fontSize: '0.8rem' },
};
