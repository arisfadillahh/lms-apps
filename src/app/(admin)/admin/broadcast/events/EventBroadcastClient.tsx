'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';

import PageHead from '@/components/admin/PageHead';
import { DEFAULT_EVENT_MESSAGE_TEMPLATE, EVENT_TEMPLATE_VARIABLES } from '@/lib/eventBroadcast';

import styles from './event-broadcast.module.css';

type EkskulClass = {
  id: string;
  name: string;
  parent_whatsapp_enabled: boolean;
  parent_whatsapp_event_enabled: boolean;
};

type Reminder = {
  reminder_type: string;
  scheduled_at: string;
  status: string;
  delivery_counts?: Record<string, number>;
};

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  status: string;
  event_broadcast_classes?: Array<{ class_id: string }>;
  event_broadcast_reminders?: Reminder[];
};

type AdminData = { classes: EkskulClass[]; events: EventRow[] };
type Preview = {
  selectedClasses: number;
  pwaRecipients: number;
  whatsappEligible: number;
  blockedByPolicy: number;
  missingPhone: number;
};

const todayJakarta = () => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
}).format(new Date());

export default function EventBroadcastClient({ initialData }: { initialData: AdminData }) {
  const [data, setData] = useState(initialData);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationMapsUrl, setLocationMapsUrl] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_EVENT_MESSAGE_TEMPLATE);
  const [reminderTime, setReminderTime] = useState('10:00');
  const [reminderTypes, setReminderTypes] = useState<string[]>(['H7', 'H1']);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'submit' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const templateRef = useRef<HTMLTextAreaElement>(null);

  const selectedClasses = useMemo(
    () => data.classes.filter((klass) => selectedClassIds.includes(klass.id)),
    [data.classes, selectedClassIds],
  );

  const toggleClass = (classId: string) => {
    setSelectedClassIds((current) => current.includes(classId)
      ? current.filter((id) => id !== classId)
      : [...current, classId]);
    setPreview(null);
  };

  const toggleReminder = (type: string) => {
    setReminderTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]);
  };

  const requestPreview = async (): Promise<Preview | null> => {
    if (selectedClassIds.length === 0) {
      setNotice({ kind: 'error', text: 'Pilih minimal satu kelas Ekskul.' });
      return null;
    }
    setBusy('preview');
    setNotice(null);
    try {
      const response = await fetch('/api/admin/broadcast/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', classIds: selectedClassIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Gagal menghitung penerima');
      setPreview(payload);
      return payload;
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal menghitung penerima' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const insertVariable = (variable: string) => {
    const token = `{${variable}}`;
    const field = templateRef.current;
    if (!field) return setMessageTemplate((current) => `${current}${token}`);
    const start = field.selectionStart;
    const end = field.selectionEnd;
    setMessageTemplate((current) => `${current.slice(0, start)}${token}${current.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const refreshEvents = async () => {
    const response = await fetch('/api/admin/broadcast/events');
    if (response.ok) setData(await response.json());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (reminderTypes.length === 0) {
      setNotice({ kind: 'error', text: 'Pilih minimal satu jadwal reminder.' });
      return;
    }
    const currentPreview = preview ?? await requestPreview();
    if (!currentPreview) return;

    const sendsNow = reminderTypes.includes('NOW');
    const confirmation = sendsNow
      ? `Kirim sekarang ke ${currentPreview.pwaRecipients} akun LMS/PWA dan maksimal ${currentPreview.whatsappEligible} WhatsApp orang tua?`
      : `Jadwalkan event untuk ${currentPreview.selectedClasses} kelas dan ${currentPreview.pwaRecipients} Coder?`;
    if (!window.confirm(confirmation)) return;

    setBusy('submit');
    setNotice(null);
    try {
      const response = await fetch('/api/admin/broadcast/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', name, eventDate, startTime, endTime,
          locationName, locationAddress, locationMapsUrl, messageTemplate,
          classIds: selectedClassIds, reminderTime, reminderTypes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const details = payload.details
          ? Object.values(payload.details).flat().filter(Boolean).join(' ')
          : '';
        throw new Error(details || payload.error || 'Gagal membuat event');
      }
      const immediateText = payload.nowQueued
        ? ' Pengiriman sekarang sudah masuk antrean dan diproses otomatis.'
        : '';
      const skippedText = payload.skippedReminderTypes?.length
        ? ` Jadwal ${payload.skippedReminderTypes.join(', ')} dilewati karena waktunya sudah lewat.`
        : '';
      setNotice({ kind: 'success', text: `Event berhasil dibuat.${immediateText}${skippedText}` });
      setName('');
      setEventDate('');
      setPreview(null);
      setSelectedClassIds([]);
      setReminderTypes(['H7', 'H1']);
      await refreshEvents();
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal membuat event' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.page}>
      <PageHead title="Broadcast Event Ekskul" desc="Satu event bisa dikirim ke beberapa kelas, dengan PWA tetap aktif dan WhatsApp mengikuti izin sekolah." />
      <Link href="/admin/broadcast" className={styles.backLink}><ArrowLeft size={17} /> Broadcast umum</Link>

      {notice ? <div role="status" className={`${styles.notice} ${styles[notice.kind]}`}>{notice.kind === 'success' ? <CheckCircle2 size={19} /> : <ShieldCheck size={19} />}{notice.text}</div> : null}

      <form onSubmit={submit} className={styles.grid}>
        <section className={styles.mainColumn}>
          <div className={styles.card}>
            <div className={styles.cardTitle}><CalendarDays size={21} /><div><h2>Detail event</h2><p>Tidak ada pendaftaran atau RSVP. Admin cukup mengatur informasi acaranya.</p></div></div>
            <div className={styles.formGrid}>
              <label className={styles.full}>Nama event<input required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Festival Game Clevio" /></label>
              <label>Tanggal<input required type="date" min={todayJakarta()} value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label>
              <label>Jam mulai<input required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></label>
              <label>Jam selesai <span>(opsional)</span><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></label>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}><MapPin size={21} /><div><h2>Lokasi</h2><p>Boleh dikosongkan untuk event online atau lokasi yang belum ditentukan.</p></div></div>
            <div className={styles.formGrid}>
              <label>Nama tempat<input maxLength={160} value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Clevio Bukit Golf" /></label>
              <label className={styles.full}>Alamat<input maxLength={500} value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="Alamat lengkap acara" /></label>
              <label className={styles.full}>Link Google Maps<input type="url" maxLength={2048} value={locationMapsUrl} onChange={(e) => setLocationMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." /></label>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}><MessageCircle size={21} /><div><h2>Template WhatsApp</h2><p>Format *tebal* dan baris baru didukung WhatsApp. Klik variabel untuk menyisipkan data asli.</p></div></div>
            <div className={styles.variables}>{EVENT_TEMPLATE_VARIABLES.map((variable) => <button type="button" key={variable} onClick={() => insertVariable(variable)}>{`{${variable}}`}</button>)}</div>
            <textarea ref={templateRef} required minLength={10} maxLength={4000} rows={14} value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} className={styles.template} />
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <div className={styles.card}>
            <div className={styles.cardTitle}><Users size={21} /><div><h2>Target kelas</h2><p>Pilih satu atau beberapa kelas Ekskul.</p></div></div>
            <div className={styles.classList}>
              {data.classes.length === 0 ? <p className={styles.empty}>Belum ada kelas Ekskul.</p> : data.classes.map((klass) => (
                <label key={klass.id} className={`${styles.classOption} ${selectedClassIds.includes(klass.id) ? styles.selected : ''}`}>
                  <input type="checkbox" checked={selectedClassIds.includes(klass.id)} onChange={() => toggleClass(klass.id)} />
                  <span><strong>{klass.name}</strong><small>{klass.parent_whatsapp_enabled && klass.parent_whatsapp_event_enabled ? 'WA event aktif' : 'WA diblokir / event mati'} · PWA aktif</small></span>
                </label>
              ))}
            </div>
            <button type="button" className={styles.secondaryButton} onClick={requestPreview} disabled={busy !== null || selectedClasses.length === 0}><Users size={17} />{busy === 'preview' ? 'Menghitung…' : 'Preview penerima'}</button>
            {preview ? (
              <div className={styles.preview}>
                <div><MonitorSmartphone size={17} /><span><strong>{preview.pwaRecipients}</strong> LMS/PWA</span></div>
                <div><MessageCircle size={17} /><span><strong>{preview.whatsappEligible}</strong> WhatsApp</span></div>
                <div><ShieldCheck size={17} /><span><strong>{preview.blockedByPolicy}</strong> diblokir kebijakan</span></div>
                <div><Users size={17} /><span><strong>{preview.missingPhone}</strong> tanpa nomor</span></div>
              </div>
            ) : null}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}><BellRing size={21} /><div><h2>Jadwal reminder</h2><p>H-7 dan H-1 dikirim pada jam yang dipilih.</p></div></div>
            <label className={styles.timeLabel}><Clock3 size={17} /> Jam kirim<input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} /></label>
            {[['H7', 'H-7 sebelum event'], ['H1', 'H-1 sebelum event'], ['NOW', 'Kirim sekarang']].map(([value, label]) => (
              <label key={value} className={styles.reminderOption}><input type="checkbox" checked={reminderTypes.includes(value)} onChange={() => toggleReminder(value)} /><span>{label}</span></label>
            ))}
            <p className={styles.safetyNote}><ShieldCheck size={16} /> PWA dikirim ke seluruh Coder aktif. WhatsApp hanya ke kelas yang diizinkan sekolah dan mengaktifkan toggle Event & Festival.</p>
          </div>

          <button type="submit" className={styles.submitButton} disabled={busy !== null || !name || !eventDate || selectedClassIds.length === 0 || reminderTypes.length === 0}><Send size={18} />{busy === 'submit' ? 'Memproses…' : 'Simpan & jadwalkan event'}</button>
        </aside>
      </form>

      <section className={`${styles.card} ${styles.history}`}>
        <div className={styles.cardTitle}><Clock3 size={21} /><div><h2>Riwayat event</h2><p>Status jadwal dan hasil pengiriman terbaru.</p></div></div>
        {data.events.length === 0 ? <p className={styles.empty}>Belum ada event broadcast.</p> : (
          <div className={styles.eventList}>{data.events.map((event) => (
            <article key={event.id} className={styles.eventRow}>
              <div><strong>{event.name}</strong><span>{new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${event.event_date}T12:00:00+07:00`))} · {event.start_time.slice(0, 5)} WIB</span></div>
              <div className={styles.eventMeta}><span>{event.event_broadcast_classes?.length ?? 0} kelas</span>{event.event_broadcast_reminders?.map((reminder) => <span key={reminder.reminder_type}>{reminder.reminder_type} · {reminder.status}</span>)}</div>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}
