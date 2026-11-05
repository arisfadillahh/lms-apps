'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PeriodDocument } from '@/lib/payroll/model';
import { dateWib } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

const labels = { WAITING: 'Menunggu', IN_PROGRESS: 'Diproses', DONE: 'Selesai', REJECTED: 'Ditolak' };
export default function PayrollCorrections({ period, admins, coaches, busy, run }: {
  period: PeriodDocument | undefined; admins: { id: string; username: string }[];
  coaches: { id: string; full_name: string }[]; busy: boolean;
  run: (action: string, extra: Record<string, unknown>, success?: string) => Promise<boolean>;
}) {
  const [filter, setFilter] = useState('OPEN');
  if (!period) return <p>Buat periode terlebih dahulu.</p>;
  const requests = (period.corrections ?? []).filter(r => filter === 'ALL' || ['WAITING', 'IN_PROGRESS'].includes(r.status));
  return <section className={styles.panel}>
    <div className={styles.toolbar}><label className={styles.field}>PIC periode<select aria-label="PIC periode" className={styles.select} disabled={busy} value={period.pic_id ?? ''} onChange={e => { void run('assignPic', { userId: e.target.value }); }}><option value="" disabled>Pilih penanggung jawab</option>{admins.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select></label><label className={styles.field}>Status<select className={styles.select} value={filter} onChange={e => setFilter(e.target.value)}><option value="OPEN">Perlu ditangani</option><option value="ALL">Semua pengajuan</option></select></label></div>
    <p className={styles.muted}>Periksa dan koreksi aktivitas pada rincian penerima, lalu selesaikan pengajuan. Tanggapan terlihat oleh coach; tulis detail aktivitas tanpa nominal.</p>
    {!requests.length && <p>Tidak ada pengajuan pada filter ini.</p>}
    {requests.map(r => <article key={r.id} className={styles.notice}><div className={styles.toolbar}><strong>{coaches.find(c => c.id === r.user_id)?.full_name ?? 'Coach'}</strong><Badge variant="secondary">{labels[r.status]}</Badge><span className={styles.rowmeta}>{dateWib(r.at)} WIB</span></div><p>{r.message}</p>{r.response && <p>Tanggapan: {r.response}</p>}{['WAITING', 'IN_PROGRESS'].includes(r.status) && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run('reviewCorrection', { id: r.id, status: f.get('status'), reason: f.get('reason') }, 'Status koreksi diperbarui.'); }}><fieldset disabled={busy} className={styles.form}><label className={styles.field}>Keputusan<select name="status" className={styles.select}><option value="IN_PROGRESS">Diproses</option><option value="DONE">Selesai</option><option value="REJECTED">Ditolak</option></select></label><label className={styles.field}>Tanggapan untuk coach<textarea name="reason" minLength={5} maxLength={1000} required className="rounded-md border p-3" /></label><Button type="submit">Simpan tanggapan</Button></fieldset></form>}</article>)}
  </section>;
}
