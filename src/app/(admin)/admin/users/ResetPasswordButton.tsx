'use client';

import { useState, useTransition } from 'react';

interface ResetPasswordButtonProps {
  userId: string;
}

export default function ResetPasswordButton({ userId }: ResetPasswordButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleReset = () => {
    const newPassword = window.prompt('Enter new temporary password (min 8 characters)');
    if (!newPassword) {
      return;
    }
    if (newPassword.length < 8) {
      window.alert('Password must be at least 8 characters.');
      return;
    }

    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          window.alert(payload.error ?? 'Failed to reset password');
          return;
        }
        setMessage('Password reset');
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Failed to reset password', error);
        window.alert('Unexpected error resetting password');
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <button
        type="button"
        onClick={handleReset}
        style={{
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid #1e3a5f',
          background: '#eff6ff',
          color: '#1e3a5f',
          fontSize: '0.85rem',
          cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
        disabled={isPending}
      >
        {isPending ? 'Resetting…' : 'Reset Password'}
      </button>
      {message ? <span style={{ fontSize: '0.75rem', color: '#15803d' }}>{message}</span> : null}
    </div>
  );
}
