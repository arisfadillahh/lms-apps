'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';

type Props = {
  classId: string;
  currentDay: string | null;
  currentTime: string | null;
};

const days = [
  ['MONDAY', 'Senin'], ['TUESDAY', 'Selasa'], ['WEDNESDAY', 'Rabu'],
  ['THURSDAY', 'Kamis'], ['FRIDAY', 'Jumat'], ['SATURDAY', 'Sabtu'], ['SUNDAY', 'Minggu'],
] as const;

export default function ChangeClassScheduleModal({ classId, currentDay, currentTime }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(currentDay || 'MONDAY');
  const [time, setTime] = useState((currentTime || '16:00').slice(0, 5));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${classId}/schedule`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduleDay: day, scheduleTime: time }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Gagal mengubah jadwal kelas');
        setOpen(false);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Gagal mengubah jadwal kelas');
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={buttonStyle}>
        <CalendarClock size={15} /> Ubah jadwal kelas
      </button>
      {open && (
        <div style={backdropStyle} onClick={() => !isPending && setOpen(false)}>
          <form onSubmit={submit} style={modalStyle} onClick={(event) => event.stopPropagation()}>
            <h2 style={headingStyle}>Ubah jadwal kelas</h2>
            <p style={descriptionStyle}>
              Perubahan berlaku untuk jadwal kelas ini dan seluruh sesi terjadwal ke depan. Sesi yang sudah selesai atau diliburkan tidak diubah.
            </p>
            <label style={labelStyle}>Hari kelas<select value={day} onChange={(event) => setDay(event.target.value)} style={inputStyle}>{days.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={labelStyle}>Jam mulai<input type="time" value={time} onChange={(event) => setTime(event.target.value)} style={inputStyle} required /></label>
            {error && <p style={errorStyle}>{error}</p>}
            <div style={actionsStyle}>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} style={cancelStyle}>Batal</button>
              <button type="submit" disabled={isPending} style={submitStyle}>{isPending ? 'Menyimpan...' : 'Simpan jadwal'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const buttonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))', overflowY: 'auto', overscrollBehavior: 'contain', background: 'rgba(15,23,42,.5)' };
const modalStyle: React.CSSProperties = { width: 'min(440px, 100%)', boxSizing: 'border-box', maxHeight: 'calc(100svh - 24px)', overflowY: 'auto', overscrollBehavior: 'contain', margin: '0 auto', padding: 24, borderRadius: 14, background: '#fff', boxShadow: '0 24px 64px rgba(15,23,42,.2)' };
const headingStyle: React.CSSProperties = { margin: 0, color: '#0f172a', fontSize: 19, fontWeight: 800 };
const descriptionStyle: React.CSSProperties = { margin: '8px 0 20px', color: '#64748b', fontSize: 13, lineHeight: 1.5 };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 6, marginBottom: 14, color: '#334155', fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontSize: 14 };
const actionsStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 20 };
const cancelStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' };
const submitStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: 0, borderRadius: 8, background: '#1e3a5f', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const errorStyle: React.CSSProperties = { margin: '8px 0', color: '#b91c1c', fontSize: 13 };
