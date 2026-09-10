'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type LifecycleStatus = 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED';

export default function ClassLifecycleControl({ classId, currentStatus }: { classId: string; currentStatus: LifecycleStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = () => {
    if (status === currentStatus) return;
    if ((status === 'ENDED' || status === 'CANCELLED') && !window.confirm('Sesi mendatang akan dibatalkan dan enrollment aktif akan ditutup. Lanjutkan?')) return;
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/admin/classes/${classId}/lifecycle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? 'Gagal memperbarui status kelas.');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={status} onChange={(event) => setStatus(event.target.value as LifecycleStatus)} aria-label="Status operasional kelas" style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', background: '#fff', color: '#0f172a' }}>
        <option value="ACTIVE">Aktif</option>
        <option value="PAUSED">Dijeda</option>
        <option value="ENDED">Selesai</option>
        <option value="CANCELLED">Ditiadakan</option>
      </select>
      <button type="button" onClick={update} disabled={pending || status === currentStatus} style={{ border: 0, borderRadius: 6, padding: '8px 12px', background: '#172554', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: pending || status === currentStatus ? .55 : 1 }}>{pending ? 'Menyimpan...' : 'Simpan status'}</button>
      {error ? <span role="alert" style={{ color: '#b91c1c', fontSize: '.78rem' }}>{error}</span> : null}
    </div>
  );
}
