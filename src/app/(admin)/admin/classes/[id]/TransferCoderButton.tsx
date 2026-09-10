'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, X } from 'lucide-react';

type TargetClass = { id: string; name: string; levelName: string | null };

export default function TransferCoderButton(props: {
  classId: string;
  coderId: string;
  coderName: string;
  targetClasses: TargetClass[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetClassId, setTargetClassId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!targetClassId || reason.trim().length < 3) {
      setError('Pilih kelas tujuan dan isi alasan perpindahan.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/classes/${props.classId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coderId: props.coderId,
          targetClassId,
          effectiveAt: new Date().toISOString(),
          reason: reason.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? 'Gagal memindahkan coder.');
        return;
      }
      if (payload.warning) setWarning(payload.warning);
      else setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={props.targetClasses.length === 0}
        title={props.targetClasses.length === 0 ? 'Tidak ada kelas tujuan aktif' : 'Pindahkan coder'}
        aria-label={`Pindahkan ${props.coderName}`}
        style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: props.targetClasses.length ? 'pointer' : 'not-allowed', opacity: props.targetClasses.length ? 1 : 0.5 }}
      >
        <ArrowRightLeft size={16} />
      </button>
      {open ? (
        <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="transfer-title" style={{ width: 'min(100%, 480px)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', borderRadius: 8, background: '#fff', padding: 20, boxShadow: '0 24px 60px rgba(15,23,42,.24)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <h2 id="transfer-title" style={{ margin: 0, color: '#172554', fontSize: '1.1rem' }}>Pindahkan {props.coderName}</h2>
                <p style={{ margin: '6px 0 18px', color: '#64748b', fontSize: '.88rem', lineHeight: 1.5 }}>Riwayat kelas asal tetap tersimpan. Jadwal, Coach, reminder, dan aktivitas berikutnya mengikuti kelas tujuan.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <label style={labelStyle}>Kelas tujuan</label>
            <select value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)} style={fieldStyle}>
              <option value="">Pilih kelas tujuan</option>
              {props.targetClasses.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}{klass.levelName ? ` · ${klass.levelName}` : ''}</option>)}
            </select>
            <label style={labelStyle}>Alasan perpindahan</label>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Contoh: pindah jadwal ke hari Kamis" style={{ ...fieldStyle, resize: 'vertical' }} />
            <div style={{ padding: 12, borderRadius: 6, background: '#f8fafc', color: '#475569', fontSize: '.82rem', lineHeight: 1.5 }}>Berlaku langsung. Enrollment kelas asal ditutup, kelas tujuan diaktifkan, dan pembayaran Weekly aktif diarahkan ke kelas tujuan.</div>
            {error ? <p role="alert" style={{ color: '#b91c1c', fontSize: '.82rem' }}>{error}</p> : null}
            {warning ? <p role="alert" style={{ color: '#b45309', fontSize: '.82rem' }}>{warning}</p> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setOpen(false)} disabled={pending} style={secondaryButton}>Batal</button>
              <button type="button" onClick={submit} disabled={pending} style={primaryButton}>{pending ? 'Memindahkan...' : 'Pindahkan sekarang'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const labelStyle = { display: 'block', color: '#334155', fontSize: '.82rem', fontWeight: 700, margin: '12px 0 6px' } as const;
const fieldStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 6, padding: '10px 12px', color: '#0f172a', background: '#fff', font: 'inherit' } as const;
const secondaryButton = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '9px 14px', background: '#fff', color: '#334155', fontWeight: 700, cursor: 'pointer' } as const;
const primaryButton = { border: 0, borderRadius: 6, padding: '9px 14px', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer' } as const;
