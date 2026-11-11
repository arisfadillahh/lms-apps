'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dateWib } from '@/lib/payroll/presentation';
import { requestLabels, type ActivityRequest, type RequestKind } from '@/lib/payroll/activityRequests';
import styles from '../../../(admin)/admin/payroll/PayrollAdmin.module.css';
async function fetchRequests(): Promise<ActivityRequest[]> {
  const r = await fetch('/api/coach/payroll/activities', { cache: 'no-store' });
  const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.requests;
}

export default function CoachActivityRequests() {
  const [requests, setRequests] = useState<ActivityRequest[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [requestId, setRequestId] = useState('');
  async function load() { setRequests(await fetchRequests()); }
  useEffect(() => { let active = true; fetchRequests().then(rows => { if (active) { setRequests(rows); setRequestId(crypto.randomUUID()); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, f = Object.fromEntries(new FormData(form));
    setBusy(true); setError(''); setSuccess('');
    try {
      const r = await fetch('/api/coach/payroll/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: requestId, activityAt: `${f.activityAt}:00+07:00`, kind: f.kind, label: f.label, notes: f.notes }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setSuccess('Aktivitas diajukan. Absensi masuk rekap setelah admin menyetujui dan memperbarui rekap.'); form.reset(); setRequestId(crypto.randomUUID()); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Pengajuan gagal.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-label="Pengajuan aktivitas coach"><h2>Absen event, training, atau observasi</h2>
    <p className={styles.muted}>Batas pengajuan tanggal 25 pukul 17.00 WIB. Setelah admin menyetujui, kegiatan masuk ke rekap absensi.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}{success && <p role="status">{success}</p>}
    <form aria-label="Form aktivitas tambahan" onSubmit={submit}><fieldset className={styles.form} disabled={busy || !requestId}>
      <label className={styles.field}>Jenis aktivitas<select name="kind" className={styles.select}>{Object.entries(requestLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className={styles.field}>Tanggal dan jam kegiatan (WIB)<Input name="activityAt" type="datetime-local" required /></label>
      <label className={`${styles.field} ${styles.wide}`}>Nama kegiatan<Input name="label" minLength={3} maxLength={160} required /></label>
      <label className={`${styles.field} ${styles.wide}`}>Rincian, lokasi, peserta, dan referensi bukti<textarea className="rounded-md border p-3" name="notes" minLength={10} maxLength={2000} rows={3} required /></label>
      <p className={`${styles.muted} ${styles.wide}`}>Kelas terjadwal tercatat otomatis. Trial tercatat setelah coach yang ditugaskan mengirim penilaian.</p>
      <Button type="submit">{busy ? 'Mengajukan…' : 'Ajukan aktivitas ke admin'}</Button>
    </fieldset></form>
    <div className={styles.toolbar}><h2>Riwayat pengajuan</h2><Button variant="ghost" size="sm" disabled={busy} onClick={() => load().catch(e => setError(e.message))}>Perbarui riwayat</Button></div>
    {requests.length ? <div className={styles.audit}>{[...requests].sort((a, b) => b.activity_at.localeCompare(a.activity_at)).map(r => <div key={r.id} className={styles.notice}><strong>{r.label}</strong> · {requestLabels[r.kind as RequestKind]}<br />{dateWib(r.activity_at)} WIB · {({ PENDING: 'Menunggu admin', APPROVED: 'Disetujui', REJECTED: 'Ditolak' })[r.status]}{r.review_reason && <p>Catatan admin: {r.review_reason}</p>}</div>)}</div> : <p className={styles.muted}>Belum ada pengajuan aktivitas tambahan.</p>}
  </section>;
}
