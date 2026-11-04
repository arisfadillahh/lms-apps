'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dateWib, rupiah } from '@/lib/payroll/presentation';
import type { Slip, Transfer, PayrollTerm, FinalVersion } from '@/lib/payroll/model';
import styles from '../../../(admin)/admin/payroll/PayrollAdmin.module.css';
import CoachActivityRequests from './CoachActivityRequests';

type OwnPeriod = { id: string; status: string; version: number; starts_at: string; ends_at: string; correction_deadline: string; calculated_at: string | null; slip: Slip; transfers: Transfer[]; history: FinalVersion[] };
export default function CoachPayroll({ initialPeriod }: { initialPeriod?: string }) {
  const [data, setData] = useState<{ profile: { name: string; terms: PayrollTerm[] } | null; periods: OwnPeriod[] } | null>(null);
  const [periodId, setPeriodId] = useState(initialPeriod ?? ''), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { fetch('/api/coach/payroll', { cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); setPeriodId(id => id || d.periods[0]?.id || ''); }).catch(e => setError(e.message)); }, []);
  const p = data?.periods.find(p => p.id === periodId);
  const paid = p?.transfers.reduce((n, t) => n + t.amount, 0) ?? 0;
  const canDownload = p?.status === 'FINAL' && p.transfers.length > 0 && paid >= p.slip.total;
  const base = p ? `/api/payroll/${p.id}/${p.slip.profile_id}/pdf` : '';
  async function correction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = e.currentTarget;
    try { const r = await fetch('/api/coach/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ periodId, message: new FormData(form).get('message') }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setMessage('Laporan koreksi dikirim kepada admin. Admin yang akan memperbarui rekap.'); form.reset(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengirim koreksi.'); } finally { setBusy(false); }
  }
  return <main className={styles.root}><header><div className={styles.eyebrow}>Akun coach / Penggajian</div><h1 className={styles.title}>Absensi &amp; Slip Gaji</h1><p className={styles.muted}>Rekap pribadi, laporan koreksi, dan slip final dari admin.</p></header>
    {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status">{message}</p>}
    {!data ? <p>Memuat rekap…</p> : !data.periods.length ? <section className={styles.panel}><h2>Belum ada rekap gaji</h2><p className={styles.muted}>Admin belum menerbitkan rekap untuk akun ini. Nomor WhatsApp dapat diatur melalui profil; jika kosong, notifikasi tetap masuk ke akun LMS.</p></section> : <>
      <section className={styles.panel}><label className={styles.field}>Arsip bulan dan tahun<select className={styles.select} value={periodId} onChange={e => setPeriodId(e.target.value)}>{data.periods.map(x => <option key={x.id} value={x.id}>{x.id} — {x.status}</option>)}</select></label>{p && <><div className={styles.toolbar}><Badge>{p.slip.contract}</Badge><Badge variant="secondary">{p.status} · versi {p.version}</Badge></div><div className={styles.notice}><strong>BATAS KOREKSI REGULER: {dateWib(p.correction_deadline)} WIB.</strong><br />Periksa sesi, penggantian coach, dan aktivitas tambahan. Laporkan selisih kepada admin sebelum deadline. Setelah batas tersebut, hubungi admin untuk pengecualian force majeure. Aktivitas tanggal 25 tetap dihitung sampai akhir hari.</div><div className={styles.stats}><div className={styles.stat}>Total rekap<strong>{rupiah(p.slip.total)}</strong></div><div className={styles.stat}>Tercatat ditransfer<strong>{rupiah(paid)}</strong></div></div><p className={styles.muted}>Terakhir dihitung: {p.calculated_at ? dateWib(p.calculated_at) + ' WIB' : 'Perhitungan sedang diperbarui'}. Rekap draft masih dapat berubah hingga admin memfinalisasi.</p><div className={styles.toolbar}>{canDownload && <Button asChild><a href={base} target="_blank" rel="noreferrer">Unduh slip gaji final</a></Button>}</div></>}</section>
      {p && <><section className={styles.panel}><h2>Rincian periode {p.id}</h2><Table className={styles.table}><TableHeader><TableRow><TableHead>Tanggal / kegiatan</TableHead><TableHead>Jenis / mode</TableHead><TableHead>Nominal</TableHead></TableRow></TableHeader><TableBody>{p.slip.lines.map(l => <TableRow key={l.key}><TableCell>{dateWib(l.date)} WIB<div className={styles.rowname}>{l.label}</div><div className={styles.rowmeta}>{l.details}{l.override_reason && ` · Koreksi admin: ${l.override_reason}`}</div></TableCell><TableCell>{l.kind} · {l.mode}{l.students !== undefined && ` · ${l.students} anak`}</TableCell><TableCell className={styles.money}>{rupiah(l.amount)}</TableCell></TableRow>)}</TableBody></Table></section>
      <section className={styles.panel}><h2>Laporkan koreksi ke admin</h2>{clock < Date.parse(p.correction_deadline) ? <form onSubmit={correction}><fieldset className={styles.form} disabled={busy}><label className={`${styles.field} ${styles.wide}`}>Tanggal, kelas, dan rincian yang perlu diperbaiki<textarea name="message" minLength={10} maxLength={2000} required rows={4} className="rounded-md border p-3" /></label><Button type="submit">{busy ? 'Mengirim…' : 'Kirim laporan koreksi'}</Button></fieldset></form> : <p className={styles.muted}>Deadline koreksi reguler sudah lewat. Hubungi admin; revisi setelah deadline hanya dapat dilakukan admin dengan alasan tercatat.</p>}</section></>}
    </>}
    <CoachActivityRequests />
  </main>;
}
