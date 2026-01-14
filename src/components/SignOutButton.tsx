'use client';

import { signOut } from 'next-auth/react';
import { type CSSProperties, type MouseEvent, useState, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

type SignOutButtonProps = {
  label?: string;
  style?: CSSProperties;
  icon?: ReactNode;
};

export default function SignOutButton({ label = 'Sign out', style, icon }: SignOutButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we only use portal on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    // Use window.location.origin to ensure redirect goes to the current domain/IP
    // This fixes issues where VPS redirects to localhost if NEXTAUTH_URL is misconfigured
    const callbackUrl = `${window.location.origin}/login`;
    await signOut({ callbackUrl });
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const modalContent = (
    <div style={backdropStyle} onClick={handleCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>Konfirmasi Sign Out</h3>
        <p style={bodyStyle}>Apakah Anda yakin ingin keluar dari aplikasi?</p>
        <div style={actionsStyle}>
          <button
            type="button"
            onClick={handleCancel}
            style={cancelButtonStyle}
            disabled={loading}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={confirmButtonStyle}
            disabled={loading}
          >
            {loading ? 'Keluar...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={{ ...baseStyle, ...style }}
        aria-label={label}
      >
        {icon}
        {label}
      </button>

      {open && mounted && createPortal(modalContent, document.body)}
    </>
  );
}

// Styles
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

const backdropStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(15, 23, 42, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999999,
};

const modalStyle: CSSProperties = {
  background: '#ffffff',
  padding: '1.5rem',
  borderRadius: '1rem',
  width: '100%',
  maxWidth: '400px',
  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
};

const titleStyle: CSSProperties = {
  margin: '0 0 0.5rem 0',
  fontSize: '1.1rem',
  fontWeight: 600,
  color: '#0f172a',
};

const bodyStyle: CSSProperties = {
  margin: '0 0 1.5rem 0',
  fontSize: '0.9rem',
  color: '#64748b',
  lineHeight: 1.5,
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
};

const cancelButtonStyle: CSSProperties = {
  padding: '0.6rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#475569',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const confirmButtonStyle: CSSProperties = {
  padding: '0.6rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#ef4444',
  color: '#ffffff',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  minWidth: '80px',
};
