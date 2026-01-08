'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface GenerateReportButtonProps {
  submissionId: string;
  disabled?: boolean;
}

export default function GenerateReportButton({ submissionId, disabled }: GenerateReportButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const response = await fetch(`/api/admin/reports/${submissionId}/generate`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        window.alert(payload.error ?? 'Failed to generate report');
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
        background: '#2563eb',
        color: '#fff',
        fontSize: '0.85rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled || isPending ? 0.6 : 1,
      }}
    >
      {isPending ? 'Generating…' : 'Generate PDF'}
    </button>
  );
}
