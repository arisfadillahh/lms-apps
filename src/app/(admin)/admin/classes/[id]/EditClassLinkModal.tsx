'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, X } from 'lucide-react';

import { normalizeClassMeetingUrl } from '@/lib/classMeetingUrl';

type Props = {
  classId: string;
  currentLink: string | null;
};

export default function EditClassLinkModal({ classId, currentLink }: Props) {
  const router = useRouter();
  const configuredLink = normalizeClassMeetingUrl(currentLink) ?? '';
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(configuredLink);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/classes/${classId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoomLink: link }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Gagal mengubah link kelas');

        setLink(payload.zoomLink || link);
        setOpen(false);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Gagal mengubah link kelas');
      }
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={buttonStyle} aria-haspopup="dialog">
        <Link2 size={16} aria-hidden="true" /> Edit link kelas
      </button>
      {open && (
        <div style={backdropStyle} onClick={() => !isPending && setOpen(false)}>
          <form
            onSubmit={submit}
            style={modalStyle}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-class-link-title"
            aria-describedby="edit-class-link-description"
          >
            <div style={modalHeaderStyle}>
              <div>
                <p style={eyebrowStyle}>LINK KELAS</p>
                <h2 id="edit-class-link-title" style={headingStyle}>Edit link kelas</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} style={closeButtonStyle} aria-label="Tutup dialog">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p id="edit-class-link-description" style={descriptionStyle}>
              Masukkan link Google Meet, Zoom, atau ruang kelas online lainnya. Link baru berlaku untuk sesi terjadwal berikutnya di kelas ini.
            </p>
            {!configuredLink && currentLink && (
              <p style={warningStyle}>Link lama masih berupa placeholder dan tidak dapat dipakai. Ganti dengan link kelas yang sebenarnya.</p>
            )}
            <label style={labelStyle}>
              Link kelas
              <input
                type="text"
                inputMode="url"
                autoComplete="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                style={inputStyle}
                placeholder="https://meet.google.com/abc-defg-hij"
                required
              />
            </label>
            {error && <p role="alert" style={errorStyle}>{error}</p>}
            <div style={actionsStyle}>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} style={cancelStyle}>Batal</button>
              <button type="submit" disabled={isPending || !link.trim()} style={submitStyle}>{isPending ? 'Menyimpan...' : 'Simpan link'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

const buttonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 11px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const backdropStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))', overflowY: 'auto', overscrollBehavior: 'contain', background: 'rgba(15,23,42,.5)' };
const modalStyle: React.CSSProperties = { width: 'min(520px, 100%)', boxSizing: 'border-box', maxHeight: 'calc(100svh - 24px)', overflowY: 'auto', margin: '0 auto', padding: 24, borderRadius: 14, background: '#fff', boxShadow: '0 24px 64px rgba(15,23,42,.2)' };
const modalHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 };
const eyebrowStyle: React.CSSProperties = { margin: '0 0 3px', color: '#2563eb', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' };
const headingStyle: React.CSSProperties = { margin: 0, color: '#0f172a', fontSize: 19, fontWeight: 800 };
const closeButtonStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, flex: '0 0 34px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer' };
const descriptionStyle: React.CSSProperties = { margin: '8px 0 18px', color: '#64748b', fontSize: 13, lineHeight: 1.5 };
const warningStyle: React.CSSProperties = { margin: '0 0 16px', padding: '10px 12px', border: '1px solid #fde68a', borderRadius: 9, background: '#fffbeb', color: '#92400e', fontSize: 12, lineHeight: 1.5 };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 6, color: '#334155', fontSize: 13, fontWeight: 700 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontSize: 14 };
const actionsStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 20 };
const cancelStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' };
const submitStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: 0, borderRadius: 8, background: '#1e3a5f', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const errorStyle: React.CSSProperties = { margin: '10px 0 0', color: '#b91c1c', fontSize: 13 };
