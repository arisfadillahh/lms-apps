'use client';

import { FilePlus2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function PublishEkskulMidtermReportButton({ classId, alreadyCreated }: { classId: string; alreadyCreated: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const createCycle = async () => {
    const confirmed = window.confirm(
      'Buat draf Rapor Tengah Semester untuk semua peserta aktif berdasarkan lesson yang sudah selesai sampai hari ini? Coach akan mereview dan mengajukan rapor ke Admin.',
    );
    if (!confirmed) return;

    setIsPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/classes/${classId}/ekskul-midterm-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cutoffAt: new Date().toISOString() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Gagal membuat draf rapor tengah semester.');
      setMessage('Pembuatan draf dimulai. Halaman akan diperbarui otomatis.');
      window.setTimeout(() => router.refresh(), 2500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Gagal membuat draf rapor tengah semester.');
    } finally {
      setIsPending(false);
    }
  };

  if (alreadyCreated) {
    return <span style={{ color: '#15803d', fontSize: '0.82rem', fontWeight: 700 }}>Rapor tengah semester sudah dibuat.</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
      <button type="button" className="btn btn-sm" onClick={createCycle} disabled={isPending}>
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />}
        {isPending ? 'Membuat draf...' : 'Terbitkan Rapor Tengah Semester'}
      </button>
      {message ? <span style={{ maxWidth: 300, fontSize: '0.75rem', color: message.includes('dimulai') ? '#15803d' : '#b91c1c', textAlign: 'right' }}>{message}</span> : null}
    </div>
  );
}
