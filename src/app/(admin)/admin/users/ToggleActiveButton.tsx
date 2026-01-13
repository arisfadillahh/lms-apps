'use client';

import { useState, useTransition, useEffect, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

type ToggleActiveButtonProps = {
  userId: string;
  initialActive: boolean;
};

export default function ToggleActiveButton({ userId, initialActive }: ToggleActiveButtonProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleToggle = (nextActive: boolean) => {
    if (nextActive === isActive) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: nextActive }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setToast({ type: 'error', message: payload.error ?? 'Gagal mengubah status' });
          return;
        }

        setIsActive(nextActive);
        setToast({
          type: 'success',
          message: nextActive ? '✅ User berhasil diaktifkan!' : '✅ User berhasil dinonaktifkan!'
        });
        router.refresh();
      } catch (error) {
        console.error('Failed to toggle user status', error);
        setToast({ type: 'error', message: 'Terjadi kesalahan saat mengubah status' });
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => handleToggle(!isActive)}
        disabled={isPending}
        style={{
          padding: '0.35rem 0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid',
          borderColor: isActive ? '#b91c1c' : '#16a34a',
          background: isActive ? '#fef2f2' : '#ecfdf3',
          color: isActive ? '#b91c1c' : '#16a34a',
          fontSize: '0.85rem',
          cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? 'Loading...' : isActive ? 'Deactivate' : 'Activate'}
      </button>

      {/* Toast Notification */}
      {toast && (
        <div style={toastContainerStyle}>
          <div
            style={{
              ...toastStyle,
              background: toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
              borderColor: toast.type === 'success' ? '#10b981' : '#ef4444',
              color: toast.type === 'success' ? '#065f46' : '#b91c1c',
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              style={closeButtonStyle}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Styles
const toastContainerStyle: CSSProperties = {
  position: 'fixed',
  top: '1.5rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 99999,
  animation: 'slideDown 0.3s ease-out',
};

const toastStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1rem 1.5rem',
  borderRadius: '0.75rem',
  border: '1px solid',
  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
  fontSize: '0.95rem',
  fontWeight: 500,
  minWidth: '300px',
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1rem',
  opacity: 0.6,
  marginLeft: 'auto',
};
