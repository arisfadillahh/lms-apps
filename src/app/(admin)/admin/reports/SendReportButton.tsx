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
        window.alert(payload.error ?? 'Gagal memublikasikan rapor');
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const whatsappStatus = payload.whatsapp?.status;
      if (whatsappStatus === 'SKIPPED_POLICY') {
        window.alert('Rapor berhasil dipublikasikan dan notifikasi LMS terkirim. WhatsApp dilewati sesuai pengaturan kelas.');
      } else if (whatsappStatus === 'SKIPPED_NO_PHONE') {
        window.alert('Rapor berhasil dipublikasikan dan notifikasi LMS terkirim. WhatsApp dilewati karena nomor orang tua belum tersedia.');
      } else if (whatsappStatus === 'FAILED') {
        window.alert(`Rapor berhasil dipublikasikan, tetapi WhatsApp gagal: ${payload.whatsapp?.warning || 'layanan tidak tersedia'}`);
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
      <Send size={15} /> {isPending ? 'Memublikasikan…' : 'Publikasikan Rapor'}
    </button>
  );
}
