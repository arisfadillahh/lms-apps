'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface SendReportButtonProps {
  reportId: string;
  disabled?: boolean;
}

export default function SendReportButton({ reportId, disabled }: SendReportButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/reports/${reportId}/send-whatsapp`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        window.alert(payload.error ?? 'Failed to trigger WhatsApp send');
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isPending}
      style={{
        padding: '0.45rem 0.85rem',
        borderRadius: '0.5rem',
        border: 'none',
        background: '#16a34a',
        color: '#fff',
        fontSize: '0.85rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled || isPending ? 0.6 : 1,
      }}
    >
      {isPending ? 'Sending…' : 'Send via WhatsApp'}
    </button>
  );
}
