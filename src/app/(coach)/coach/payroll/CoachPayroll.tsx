'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateWib } from '@/lib/payroll/presentation';
import type { CoachPeriodView } from '@/lib/payroll/coachView';
import styles from '../../../(admin)/admin/payroll/PayrollAdmin.module.css';
import CoachActivityRequests from './CoachActivityRequests';

const statuses = { WAITING: 'Menunggu', IN_PROGRESS: 'Diproses', DONE: 'Selesai', REJECTED: 'Ditolak' };
export default function CoachPayroll({ initialPeriod }: { initialPeriod?: string }) {
  const [data, setData] = useState<{ profile: { name: string } | null; periods: CoachPeriodView[] } | null>(null);
  const [periodId, setPeriodId] = useState(initialPeriod ?? ''), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  async function load() {
    const r = await fetch('/api/coach/payroll', { cache: 'no-store' }), d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d); setPeriodId(id => id || d.periods[0]?.id || '');
  }
  useEffect(() => { let active = true; fetch('/api/coach/payroll', { cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); if (active) { setData(d); setPeriodId(id => id || d.periods[0]?.id || ''); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  const p = data?.periods.find(p => p.id === periodId);
  async function correction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = e.currentTarget, id = requestId ?? crypto.randomUUID(); setRequestId(id);
    try {
      const r = await fetch('/api/coach/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, periodId, message: new FormData(form).get('message') }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setMessage('Pengajuan tersimpan. Pantau tanggapan admin di bawah.'); form.reset(); setRequestId(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengirim koreksi.'); } finally { setBusy(false); }
  }
  return <main className={styles.root}>
    <header><div className={styles.eyebrow}>Akun coach</div><h1 className={styles.title}>Absensi &amp; Slip Gaji</h1><p className={styles.muted}>Periksa aktivitas dan pantau pengajuan koreksi. Slip tersedia setelah pembayaran dicatat.</p></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status">{message}</p>}
    {!data ? <p>Memuat rekap…</p> : !data.periods.length ? <section className={styles.panel}><h2>Belum ada rekap absensi</h2><p className={styles.muted}>Rekap belum tersedia. Nomor WhatsApp mengikuti profil coach; jika kosong, notifikasi masuk ke akun LMS.</p></section> : <>
      <section className={styles.panel}><div className={styles.toolbar}><label className={styles.field}>Arsip bulan dan tahun<select className={styles.select} value={periodId} onChange={e => { setPeriodId(e.target.value); setRequestId(null); }}>{data.periods.map(x => <option key={x.id} value={x.id}>{x.id}</option>)}</select></label>{p?.slipUrl && <Button asChild><a href={p.slipUrl} target="_blank" rel="noreferrer">Buka slip gaji final</a></Button>}</div>
        {p && <><div className={styles.notice}><strong>BATAS KOREKSI: {dateWib(p.correction_deadline)} WIB.</strong><br />Periksa tanggal, kelas, pengganti, dan aktivitas tambahan. Pengajuan ditutup tepat pukul 17.00 WIB. Aktivitas tanggal 25 setelah batas tersebut tetap masuk otomatis sampai akhir hari.</div><p className={styles.muted}>Terakhir diperbarui: {p.calculated_at ? dateWib(p.calculated_at) + ' WIB' : 'Menunggu pembaruan'}.</p></>}
      </section>
      {p && <><section className={styles.panel}><h2>Aktivitas periode {p.id}</h2><Table className={styles.table}><TableHeader><TableRow><TableHead>Tanggal / kegiatan</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{p.activities.length ? p.activities.map(l => <TableRow key={l.key}><TableCell>{dateWib(l.date)} WIB<div className={styles.rowname}>{l.label}</div></TableCell><TableCell>{l.kind.replaceAll('_', ' ')}{l.students !== undefined && ['WEEKLY', 'EKSKUL', 'TRIAL'].includes(l.kind) && <div className={styles.rowmeta}>{l.students} anak</div>}</TableCell><TableCell>{l.status}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3}>Belum ada aktivitas tercatat.</TableCell></TableRow>}</TableBody></Table></section>
        <section className={styles.panel}><h2>Pengajuan koreksi</h2>{p.status === 'DRAFT' && clock < Date.parse(p.correction_deadline) ? <form onSubmit={correction}><fieldset className={styles.form} disabled={busy}><label className={`${styles.field} ${styles.wide}`}>Tanggal, kelas, dan rincian yang perlu diperbaiki<textarea name="message" minLength={10} maxLength={2000} required rows={3} className="rounded-md border p-3" onChange={() => setRequestId(null)} /></label><Button type="submit">{busy ? 'Mengirim…' : 'Ajukan koreksi'}</Button></fieldset></form> : <p className={styles.muted}>Pengajuan ditutup. Batas koreksi tanggal 25 pukul 17.00 WIB.</p>}
          {p.corrections.map(r => <div key={r.id} className={styles.notice}><Badge variant="secondary">{statuses[r.status]}</Badge><span className={styles.rowmeta}> {dateWib(r.at)} WIB</span><p>{r.message}</p>{r.response && <p>Tanggapan admin: {r.response}</p>}</div>)}
        </section></>}
    </>}
    <CoachActivityRequests />
  </main>;
}
