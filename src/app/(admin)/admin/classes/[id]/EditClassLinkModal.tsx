'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, MessageCircle, Settings2, Wifi, X } from 'lucide-react';

import { normalizeClassMeetingUrl } from '@/lib/classMeetingUrl';

type Props = {
  classId: string;
  classType: 'WEEKLY' | 'EKSKUL';
  currentLink: string | null;
  currentDeliveryMode: 'ONLINE' | 'OFFLINE';
  currentLocationName: string | null;
  currentLocationAddress: string | null;
  currentLocationMapsUrl: string | null;
  currentParentWhatsappEnabled: boolean;
  currentParentWhatsappClassReminderEnabled: boolean;
  currentParentWhatsappAbsenceEnabled: boolean;
  currentParentWhatsappMakeupEnabled: boolean;
  currentParentWhatsappReportEnabled: boolean;
  currentParentWhatsappEventEnabled: boolean;
};

export default function EditClassLinkModal({
  classId,
  classType,
  currentLink,
  currentDeliveryMode,
  currentLocationName,
  currentLocationAddress,
  currentLocationMapsUrl,
  currentParentWhatsappEnabled,
  currentParentWhatsappClassReminderEnabled,
  currentParentWhatsappAbsenceEnabled,
  currentParentWhatsappMakeupEnabled,
  currentParentWhatsappReportEnabled,
  currentParentWhatsappEventEnabled,
}: Props) {
  const router = useRouter();
  const configuredLink = normalizeClassMeetingUrl(currentLink) ?? '';
  const [open, setOpen] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState(currentDeliveryMode);
  const [link, setLink] = useState(configuredLink);
  const [locationName, setLocationName] = useState(currentLocationName ?? '');
  const [locationAddress, setLocationAddress] = useState(currentLocationAddress ?? '');
  const [locationMapsUrl, setLocationMapsUrl] = useState(currentLocationMapsUrl ?? '');
  const [parentWhatsappEnabled, setParentWhatsappEnabled] = useState(currentParentWhatsappEnabled);
  const [parentWhatsappClassReminderEnabled, setParentWhatsappClassReminderEnabled] = useState(currentParentWhatsappClassReminderEnabled);
  const [parentWhatsappAbsenceEnabled, setParentWhatsappAbsenceEnabled] = useState(currentParentWhatsappAbsenceEnabled);
  const [parentWhatsappMakeupEnabled, setParentWhatsappMakeupEnabled] = useState(currentParentWhatsappMakeupEnabled);
  const [parentWhatsappReportEnabled, setParentWhatsappReportEnabled] = useState(currentParentWhatsappReportEnabled);
  const [parentWhatsappEventEnabled, setParentWhatsappEventEnabled] = useState(currentParentWhatsappEventEnabled);
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
          body: JSON.stringify({
            deliveryMode,
            zoomLink: link,
            locationName,
            locationAddress,
            locationMapsUrl,
            parentWhatsappEnabled,
            parentWhatsappClassReminderEnabled,
            parentWhatsappAbsenceEnabled,
            parentWhatsappMakeupEnabled,
            parentWhatsappReportEnabled,
            parentWhatsappEventEnabled,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Gagal mengubah link kelas');

        setLink(payload.zoomLink ?? link);
        setParentWhatsappEnabled(payload.parentWhatsappEnabled ?? parentWhatsappEnabled);
        setParentWhatsappClassReminderEnabled(payload.parentWhatsappClassReminderEnabled ?? parentWhatsappClassReminderEnabled);
        setParentWhatsappAbsenceEnabled(payload.parentWhatsappAbsenceEnabled ?? parentWhatsappAbsenceEnabled);
        setParentWhatsappMakeupEnabled(payload.parentWhatsappMakeupEnabled ?? parentWhatsappMakeupEnabled);
        setParentWhatsappReportEnabled(payload.parentWhatsappReportEnabled ?? parentWhatsappReportEnabled);
        setParentWhatsappEventEnabled(payload.parentWhatsappEventEnabled ?? parentWhatsappEventEnabled);
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
        <Settings2 size={16} aria-hidden="true" /> Atur kelas
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
                <p style={eyebrowStyle}>METODE & AKSES KELAS</p>
                <h2 id="edit-class-link-title" style={headingStyle}>Atur Online atau Offline</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} style={closeButtonStyle} aria-label="Tutup dialog">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p id="edit-class-link-description" style={descriptionStyle}>
              Pengaturan ini menjadi sumber tombol kelas di dashboard Coder dan detail pengingat otomatis.
            </p>
            {deliveryMode === 'ONLINE' && !configuredLink && currentLink && (
              <p style={warningStyle}>Link lama masih berupa placeholder dan tidak dapat dipakai. Ganti dengan link kelas yang sebenarnya.</p>
            )}
            <label style={labelStyle}>
              Metode kelas
              <select value={deliveryMode} onChange={(event) => setDeliveryMode(event.target.value as 'ONLINE' | 'OFFLINE')} style={inputStyle}>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline / Tatap muka</option>
              </select>
            </label>
            {deliveryMode === 'ONLINE' ? (
              <label style={{ ...labelStyle, marginTop: 14 }}>
                <span style={labelWithIconStyle}><Wifi size={15} /> Link kelas online</span>
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
            ) : (
              <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
                <label style={labelStyle}>
                  <span style={labelWithIconStyle}><MapPin size={15} /> Nama tempat</span>
                  <input value={locationName} onChange={(event) => setLocationName(event.target.value)} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  Alamat lengkap
                  <textarea value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} style={{ ...inputStyle, minHeight: 78, resize: 'vertical' }} required />
                </label>
                <label style={labelStyle}>
                  Link Google Maps
                  <input type="url" value={locationMapsUrl} onChange={(event) => setLocationMapsUrl(event.target.value)} style={inputStyle} required />
                </label>
              </div>
            )}
            {classType === 'EKSKUL' ? (
              <fieldset style={whatsappSettingsStyle}>
                <legend style={whatsappLegendStyle}><MessageCircle size={18} color="#2563eb" /> WhatsApp otomatis ke orang tua</legend>
                <span style={toggleHelpStyle}>PWA/notifikasi LMS tetap aktif. Kebijakan sekolah di bawah ini menjadi pengaman untuk seluruh WhatsApp orang tua.</span>
                <label style={toggleStyle}>
                  <input type="checkbox" checked={parentWhatsappEnabled} onChange={(event) => setParentWhatsappEnabled(event.target.checked)} style={checkboxStyle} />
                  <span><strong style={toggleTitleStyle}>Sekolah mengizinkan WhatsApp orang tua</strong><span style={toggleHelpStyle}>Matikan untuk memblokir semua jenis pesan WA dari kelas ini.</span></span>
                </label>
                <label style={toggleStyle}>
                  <input type="checkbox" checked={parentWhatsappClassReminderEnabled} disabled={!parentWhatsappEnabled} onChange={(event) => setParentWhatsappClassReminderEnabled(event.target.checked)} style={checkboxStyle} />
                  <span><strong style={toggleTitleStyle}>Pengingat jadwal kelas</strong><span style={toggleHelpStyle}>Pesan H-1 berisi waktu dan akses/lokasi kelas.</span></span>
                </label>
                <label style={toggleStyle}>
                  <input type="checkbox" checked={parentWhatsappAbsenceEnabled} disabled={!parentWhatsappEnabled} onChange={(event) => setParentWhatsappAbsenceEnabled(event.target.checked)} style={checkboxStyle} />
                  <span><strong style={toggleTitleStyle}>Notifikasi tidak hadir</strong><span style={toggleHelpStyle}>Pesan ketika Coder dicatat Absent atau Excused.</span></span>
                </label>
                <label style={toggleStyle}>
                  <input type="checkbox" checked={parentWhatsappMakeupEnabled} disabled={!parentWhatsappEnabled} onChange={(event) => setParentWhatsappMakeupEnabled(event.target.checked)} style={checkboxStyle} />
                  <span><strong style={toggleTitleStyle}>Reminder tugas makeup</strong><span style={toggleHelpStyle}>Pengingat H-3 dan H-1 sebelum tenggat tugas susulan.</span></span>
                </label>
                <label style={toggleStyle}>
                  <input type="checkbox" checked={parentWhatsappReportEnabled} disabled={!parentWhatsappEnabled} onChange={(event) => setParentWhatsappReportEnabled(event.target.checked)} style={checkboxStyle} />
                  <span><strong style={toggleTitleStyle}>Kirim rapor</strong><span style={toggleHelpStyle}>WhatsApp saat Admin memublikasikan rapor.</span></span>
                </label>
                <label style={toggleStyle}>
                  <input type="checkbox" checked={parentWhatsappEventEnabled} disabled={!parentWhatsappEnabled} onChange={(event) => setParentWhatsappEventEnabled(event.target.checked)} style={checkboxStyle} />
                  <span><strong style={toggleTitleStyle}>Event & festival</strong><span style={toggleHelpStyle}>Reminder event yang menargetkan kelas ini.</span></span>
                </label>
              </fieldset>
            ) : null}
            {error && <p role="alert" style={errorStyle}>{error}</p>}
            <div style={actionsStyle}>
              <button type="button" onClick={() => setOpen(false)} disabled={isPending} style={cancelStyle}>Batal</button>
              <button
                type="submit"
                disabled={isPending || (deliveryMode === 'ONLINE' ? !link.trim() : !locationName.trim() || !locationAddress.trim() || !locationMapsUrl.trim())}
                style={submitStyle}
              >
                {isPending ? 'Menyimpan...' : 'Simpan pengaturan'}
              </button>
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
const labelWithIconStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6 };
const whatsappSettingsStyle: React.CSSProperties = { display: 'grid', gap: 2, marginTop: 16, padding: 13, border: '1px solid #bfdbfe', borderRadius: 10, background: '#eff6ff', color: '#334155' };
const whatsappLegendStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 4px', color: '#1e293b', fontSize: 13, fontWeight: 700 };
const toggleStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, paddingTop: 10, color: '#334155', fontSize: 13, cursor: 'pointer' };
const checkboxStyle: React.CSSProperties = { width: 18, height: 18, flex: '0 0 18px', accentColor: '#2563eb' };
const toggleTitleStyle: React.CSSProperties = { display: 'block', color: '#1e293b' };
const toggleHelpStyle: React.CSSProperties = { display: 'block', color: '#64748b', fontSize: 12, lineHeight: 1.5 };
const actionsStyle: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 20 };
const cancelStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer' };
const submitStyle: React.CSSProperties = { flex: '1 1 140px', padding: '9px 14px', border: 0, borderRadius: 8, background: '#1e3a5f', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const errorStyle: React.CSSProperties = { margin: '10px 0 0', color: '#b91c1c', fontSize: 13 };
