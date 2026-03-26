'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';

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
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontWeight: 600,
        transition: 'all 0.2s',
      }}
    >
      <Send size={15} /> {isPending ? 'Mengirim…' : 'Publish & Kirim WA'}
    </button>
  );
}
