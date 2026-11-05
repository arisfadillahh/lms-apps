'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CorrectionRequest } from '@/lib/payroll/model';
import { dateWib } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

const labels = { WAITING: 'Menunggu', IN_PROGRESS: 'Diproses', DONE: 'Selesai', REJECTED: 'Ditolak' };
export default function PayrollCorrections({ period, admins, coaches, busy, run, inspect }: {
  period: { pic_id?: string | null; corrections?: Omit<CorrectionRequest, 'reviewed_by'>[] } | undefined; admins: { id: string; username: string }[];
  coaches: { id: string; full_name: string }[]; busy: boolean;
  run: (action: string, extra: Record<string, unknown>, success?: string) => Promise<boolean>;
  inspect?: (userId: string) => void;
}) {
  const [filter, setFilter] = useState('OPEN');
  if (!period) return <p>Buat periode terlebih dahulu.</p>;
  const requests = (period.corrections ?? []).filter(r => filter === 'ALL' || ['WAITING', 'IN_PROGRESS'].includes(r.status));
  return <section className={styles.panel}>
    <div className={styles.toolbar}><label className={styles.field}>PIC periode<select aria-label="PIC periode" className={styles.select} disabled={busy} value={period.pic_id ?? ''} onChange={e => { void run('assignPic', { userId: e.target.value }); }}><option value="" disabled>Pilih penanggung jawab</option>{admins.map(a => <option key={a.id} value={a.id}>{a.username}</option>)}</select></label><label className={styles.field}>Status<select className={styles.select} value={filter} onChange={e => setFilter(e.target.value)}><option value="OPEN">Perlu ditangani</option><option value="ALL">Semua pengajuan</option></select></label></div>
    <p className={styles.muted}>PIC operasional: admin atau coach lead. Finance juga boleh mengoreksi untuk kebutuhan seperti force majeure, dengan alasan tercatat. Tanggapan terlihat oleh coach; tulis detail aktivitas tanpa nominal.</p>
    {!requests.length && <p className={styles.muted}>{filter === 'OPEN' ? 'Tidak ada koreksi yang menunggu. Gunakan daftar aktivitas untuk memeriksa absensi atau pilih Semua pengajuan untuk melihat riwayat.' : 'Belum ada pengajuan koreksi pada periode ini.'}</p>}
    {requests.map(r => <article key={r.id} className={styles.notice}><div className={styles.toolbar}><strong>{coaches.find(c => c.id === r.user_id)?.full_name ?? 'Coach'}</strong><Badge variant="secondary">{labels[r.status]}</Badge><span className={styles.rowmeta}>{dateWib(r.at)} WIB</span></div><p>{r.message}</p>{inspect && <Button variant="outline" size="sm" disabled={busy} onClick={() => inspect(r.user_id)}>Periksa aktivitas coach</Button>}{r.response && <p>Tanggapan: {r.response}</p>}{['WAITING', 'IN_PROGRESS'].includes(r.status) && <form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void run('reviewCorrection', { id: r.id, status: f.get('status'), reason: f.get('reason') }, 'Status koreksi diperbarui.'); }}><fieldset disabled={busy} className={styles.form}><label className={styles.field}>Keputusan<select name="status" className={styles.select}><option value="IN_PROGRESS">Diproses</option><option value="DONE">Selesai</option><option value="REJECTED">Ditolak</option></select></label><label className={styles.field}>Tanggapan untuk coach<textarea name="reason" minLength={5} maxLength={1000} required className="rounded-md border p-3" /></label><Button type="submit">Simpan tanggapan</Button></fieldset></form>}</article>)}
  </section>;
}
