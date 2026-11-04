'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requestLabels, type ActivityRequest } from '@/lib/payroll/activityRequests';
import { dateWib } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

export default function PayrollRequests({ requests, coaches, period, busy, review }: { requests: ActivityRequest[]; coaches: { id: string; full_name: string }[]; period: string; busy: boolean; review: (extra: Record<string, unknown>) => Promise<void> }) {
  const [status, setStatus] = useState('PENDING'), [selected, setSelected] = useState<string | null>(null);
  const r = requests.find(x => x.id === selected);
  return <section className={styles.panel}><h2>Pengajuan aktivitas coach · {period}</h2>
    <p className={styles.muted}>Pilih periode di atas, tinjau bukti, lalu setujui atau tolak pengajuan. Setelah disetujui, hitung ulang rekap. Untuk mengubah periode final, buka revisi melalui Riwayat periode.</p>
    <label className={styles.field}>Status pengajuan<select className={styles.select} value={status} onChange={e => setStatus(e.target.value)}><option value="PENDING">Menunggu admin</option><option value="APPROVED">Disetujui</option><option value="REJECTED">Ditolak</option><option value="ALL">Semua status</option></select></label>
    <Table className={styles.table}><TableHeader><TableRow><TableHead>Coach / kegiatan</TableHead><TableHead>Tanggal WIB</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead><TableHead>Tindakan</TableHead></TableRow></TableHeader><TableBody>{requests.filter(r => status === 'ALL' || r.status === status).map(r => <TableRow key={r.id}><TableCell><strong>{coaches.find(c => c.id === r.coach_id)?.full_name}</strong><p>{r.label}</p></TableCell><TableCell>{dateWib(r.activity_at)}</TableCell><TableCell>{requestLabels[r.kind]}</TableCell><TableCell>{({ PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak' })[r.status]}</TableCell><TableCell><Button size="sm" variant="outline" disabled={busy} onClick={() => setSelected(r.id)}>Tinjau aktivitas</Button></TableCell></TableRow>)}</TableBody></Table>
    {requests.filter(r => status === 'ALL' || r.status === status).length === 0 && <p className={styles.muted}>Tidak ada pengajuan dengan filter ini.</p>}
    {r && <form key={`${r.id}:${r.revision}`} aria-label="Tinjauan aktivitas" onSubmit={e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); review({ id: r.id, requestRevision: r.revision, status: f.status, mode: f.mode, reason: f.reason }).then(() => setSelected(null)); }}><fieldset disabled={busy} className={styles.form}>
      <legend>{r.label}</legend><p className={`${styles.notice} ${styles.wide}`}>{r.notes}</p>
      <label className={styles.field}>Keputusan<select name="status" className={styles.select}><option value="APPROVED">Setujui aktivitas</option><option value="REJECTED">Tolak aktivitas</option></select></label>
      <label className={styles.field}>Mode fee untuk kegiatan ini<select name="mode" className={styles.select} defaultValue={r.mode}><option value="MITRA">Mitra — fee aktivitas</option><option value="FULLTIME">Fulltime — gaji tetap</option></select></label>
      <label className={`${styles.field} ${styles.wide}`}>Alasan persetujuan / penolakan<Input name="reason" minLength={5} maxLength={1000} required /></label>
      <p className={`${styles.muted} ${styles.wide}`}>Observasi memakai tarif online/offline yang berlaku pada tanggal kegiatan. Trial fulltime tanpa fee trial. Setelah keputusan tersimpan, klik Hitung ulang pada rekap.</p>
      <Button type="submit">Simpan keputusan aktivitas</Button><Button type="button" variant="ghost" onClick={() => setSelected(null)}>Tutup tinjauan</Button>
    </fieldset></form>}
  </section>;
}
