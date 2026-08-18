'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, X } from 'lucide-react';

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
  const currentDayLabel = days.find(([value]) => value === currentDay)?.[1] ?? currentDay ?? 'Belum diatur';

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
      <button type="button" onClick={() => setOpen(true)} style={buttonStyle} aria-haspopup="dialog" aria-label="Ubah jadwal berulang kelas">
        <CalendarClock size={16} aria-hidden="true" /> Ubah jadwal berulang
      </button>
      {open && (
        <div style={backdropStyle} onClick={() => !isPending && setOpen(false)}>
          <form onSubmit={submit} style={modalStyle} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="change-schedule-title">
            <div style={modalHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>JADWAL BERULANG</p>
                <h2 id="change-schedule-title" style={headingStyle}>Ubah jadwal kelas</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} style={closeButtonStyle} aria-label="Tutup dialog">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p style={descriptionStyle}>
              Perubahan ini berlaku terus untuk kelas ini. Sesi mendatang yang masih berstatus terjadwal akan dipindahkan ke hari dan jam baru.
            </p>
            <div style={currentScheduleStyle}>
              <span style={currentScheduleLabelStyle}>Jadwal saat ini</span>
              <strong>{currentDayLabel} · {(currentTime || 'Belum diatur').slice(0, 5)} WIB</strong>
            </div>
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
const modalHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 };
const eyebrowStyle: React.CSSProperties = { margin: '0 0 3px', color: '#2563eb', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' };
const headingStyle: React.CSSProperties = { margin: 0, color: '#0f172a', fontSize: 19, fontWeight: 800 };
const closeButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, flex: '0 0 34px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer' };
const descriptionStyle: React.CSSProperties = { margin: '8px 0 20px', color: '#64748b', fontSize: 13, lineHeight: 1.5 };
const currentScheduleStyle: React.CSSProperties = { display: 'grid', gap: 4, marginBottom: 16, padding: '10px 12px', borderRadius: 9, background: '#f8fafc', color: '#1e3a8a', fontSize: 13 };
const currentScheduleLabelStyle: React.CSSProperties = { color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 6, marginBottom: 14, color: '#334155', fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 10px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontSize: 14 };
const actionsStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 20 };
const cancelStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' };
const submitStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: 0, borderRadius: 8, background: '#1e3a5f', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const errorStyle: React.CSSProperties = { margin: '8px 0', color: '#b91c1c', fontSize: 13 };
