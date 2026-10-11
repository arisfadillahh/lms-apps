'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type TargetClass = { id: string; name: string; levelName: string | null };

export default function TransferCoderButton(props: {
  classId: string; coderId: string; coderName: string; targetClasses: TargetClass[];
  recommendedTargetClassId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState(props.recommendedTargetClassId ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recommendedName = props.targetClasses.find((klass) => klass.id === props.recommendedTargetClassId)?.name;

  function submit() {
    if (!targetClassId || reason.trim().length < 3) return setError('Pilih kelas tujuan dan isi alasan.');
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${props.classId}/transfer`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coderId: props.coderId, targetClassId, effectiveAt: new Date().toISOString(), reason: reason.trim() }),
        });
        const payload = await response.json();
        if (!response.ok) return setError(payload.error ?? 'Gagal memindahkan coder.');
        if (payload.warning) setWarning(payload.warning);
        else setOpen(false);
        router.refresh();
      } catch { setError('Koneksi gagal. Coba lagi.'); }
    });
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} disabled={props.targetClasses.length === 0}
      aria-label={`Pindahkan ${props.coderName}`} title="Pindahkan coder ke kelas aktif pada level sama" >
      {recommendedName ? `Pindahkan ke kelas ${recommendedName}` : 'Pindah kelas'}</button>
    {open && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', background: 'rgba(15,23,42,.55)', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="transfer-title" style={{ background: 'white', padding: 20, width: 'min(100%, 480px)', borderRadius: 8 }}>
        <h2 id="transfer-title">Pindahkan {props.coderName}</h2>
        <p>Riwayat absen dan capaian pribadi tetap tersimpan. Sesi historis kelas tujuan tidak menandai blok pribadi selesai.</p>
        <label htmlFor="transfer-target">Kelas tujuan</label>
        <select id="transfer-target" value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)} style={{ display: 'block', width: '100%', marginBottom: 12 }}>
          <option value="">Pilih kelas</option>
          {props.targetClasses.map((target) => <option key={target.id} value={target.id}>{target.name}{target.levelName ? ` · ${target.levelName}` : ''}</option>)}
        </select>
        <label htmlFor="transfer-reason">Alasan perpindahan</label>
        <textarea id="transfer-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500}
          rows={3} style={{ display: 'block', width: '100%', marginBottom: 12 }} />
        {error && <p role="alert">{error}</p>}{warning && <p role="alert">{warning}</p>}
        <button type="button" onClick={() => setOpen(false)} disabled={pending}>Batal</button>{' '}
        <button type="button" onClick={submit} disabled={pending}>{pending ? 'Memindahkan...' : 'Pindahkan'}</button>
      </div>
    </div>}
  </>;
}
