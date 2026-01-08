'use client';

import { signOut } from 'next-auth/react';
import type { CSSProperties, MouseEvent } from 'react';

type SignOutButtonProps = {
  label?: string;
  style?: CSSProperties;
};

const baseStyle: CSSProperties = {
  padding: '0.5rem 0.85rem',
  borderRadius: '0.5rem',
  border: '1px solid rgba(248, 250, 252, 0.4)',
  background: 'transparent',
  color: '#f8fafc',
  fontSize: '0.85rem',
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

export default function SignOutButton({ label = 'Sign out', style }: SignOutButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void signOut({ callbackUrl: '/login' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{ ...baseStyle, ...style }}
      aria-label={label}
    >
      {label}
    </button>
  );
}
