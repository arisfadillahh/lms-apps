'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { latestLegacySnapshot, type LegacyPayrollSnapshot } from '@/lib/payroll/legacyImport';
import { dateWib, rupiah } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

export default function PayrollLegacyImport({ snapshots }: { snapshots: LegacyPayrollSnapshot[] }) {
  const [sourceId, setSourceId] = useState(''), [search, setSearch] = useState(''), [detailId, setDetailId] = useState<string | null>(null);
  const source = snapshots.find(s => s.sourceId === sourceId) ?? latestLegacySnapshot(snapshots);
  if (!source) return null;
  const visible = source.rows.filter(row => `${row.name} ${row.username}`.toLowerCase().includes(search.toLowerCase()));
  const detail = source.rows.find(row => row.sourceId === detailId);
  const count = (row: typeof source.rows[number], prefix: string) => row.counters.filter(c => c.label.startsWith(prefix)).reduce((n, c) => n + c.value, 0);
  return <section className={styles.panel} aria-label="Rekap impor sistem lama">
    <div className={styles.periodSummary}><span><strong>{source.rows.length}</strong> coach</span><span>{source.totalBasis === 'SOURCE_TOTAL' ? 'Total sumber' : 'Jumlah fee terisi'} <strong>{rupiah(source.total)}</strong></span><span>Diambil {dateWib(source.capturedAt)} WIB</span></div>
    <p className={styles.muted}>Sistem lama tetap menjadi patokan. Angka dan progres ini tersimpan sesuai waktu impor; perubahan berikutnya di n8n belum otomatis masuk. Pembayaran dan pengiriman tetap diproses melalui sistem lama.</p>
    {source.totalBasis !== 'SOURCE_TOTAL' && <p className={styles.notice}>Ada total yang belum diisi di arsip ini. Untuk baris tersebut, nominal menunjukkan jumlah fee yang terisi. Fee kosong tetap ditandai kosong, bukan dihitung memakai tarif baru.</p>}
    <div className={styles.toolbar}>
      <Input aria-label="Cari coach sistem lama" placeholder="Cari nama coach" value={search} onChange={e => setSearch(e.target.value)} />
      {snapshots.length > 1 && <select aria-label="Versi arsip sumber" className={styles.select} value={source.sourceId} onChange={e => { setSourceId(e.target.value); setDetailId(null); }}>{[...snapshots].sort((a,b) => b.sourceCreatedAt.localeCompare(a.sourceCreatedAt)).map(s => <option key={s.sourceId} value={s.sourceId}>Salinan {dateWib(s.sourceCreatedAt)} WIB</option>)}</select>}
    </div>
    <p className="text-xs text-muted-foreground sm:hidden">Geser tabel untuk melihat progres dan nominal.</p>
    <Table className={styles.table}><TableHeader><TableRow><TableHead>Coach</TableHead><TableHead>Kelas</TableHead><TableHead>Trial</TableHead><TableHead>Kegiatan lain</TableHead><TableHead>Estimasi sumber</TableHead><TableHead>Rincian</TableHead></TableRow></TableHeader><TableBody>{visible.map(row => <TableRow key={row.sourceId}>
      <TableCell><div className={styles.rowname}>{row.name}</div><div className={styles.rowmeta}>{row.username}</div></TableCell>
      <TableCell>{count(row, 'Absen Online') + count(row, 'Absen Offline')}</TableCell><TableCell>{count(row, 'Absen Trial')}</TableCell><TableCell>{row.counters.filter(c => !/^(Absen Online|Absen Offline|Absen Trial|Transport)/.test(c.label)).reduce((n,c) => n+c.value,0)}</TableCell>
      <TableCell className={styles.money}>{rupiah(row.total)}{row.sourceTotal === null && <div className={styles.rowmeta}>Jumlah fee terisi</div>}{row.extras.length > 0 && <div className={styles.rowmeta}>Ada catatan tambahan di sumber</div>}</TableCell><TableCell><Button size="sm" variant="outline" aria-label={`Rincian sumber ${row.name}`} onClick={() => setDetailId(row.sourceId)}>Rincian</Button></TableCell>
    </TableRow>)}</TableBody></Table>
    {!visible.length && <p className={styles.empty}>Nama coach tidak ditemukan.</p>}
    <details className={styles.disclosure}><summary>Asal data &amp; batas pencatatan</summary><p className={styles.muted}><a href={source.url} target="_blank" rel="noreferrer">{source.sourceName}</a> · Terakhir diubah di sumber {dateWib(source.sourceModifiedAt)} WIB. Semua hitungan dan fee termasuk transport dipertahankan. Sumber tidak mencatat tanggal setiap sesi, status kontrak, atau bukti transfer; impor tidak membuat asumsi untuk ketiganya. Akun coach tidak dipasangkan berdasarkan kemiripan nama. Versi arsip dalam bulan yang sama tidak dijumlahkan.</p></details>
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetailId(null); }}><DialogContent className={styles.modal}><DialogHeader className={styles.modalHeader}><DialogTitle>{detail?.name} · Rekap {source.period}</DialogTitle><DialogDescription>Jumlah aktivitas dan nominal asli sistem lama. Rekap kumulatif tidak memiliki tanggal sesi.</DialogDescription></DialogHeader><div className={styles.modalBody}>{detail && <>
      <h3>Progres aktivitas</h3><Table><TableHeader><TableRow><TableHead>Aktivitas</TableHead><TableHead>Jumlah</TableHead></TableRow></TableHeader><TableBody>{detail.counters.map(c => <TableRow key={c.label}><TableCell>{c.label}</TableCell><TableCell>{c.value}</TableCell></TableRow>)}</TableBody></Table>
      <h3>Komponen penghasilan</h3><Table><TableHeader><TableRow><TableHead>Komponen</TableHead><TableHead>Nominal</TableHead></TableRow></TableHeader><TableBody>{detail.fees.map(f => <TableRow key={f.label}><TableCell>{f.label}</TableCell><TableCell className={styles.money}>{f.value === null ? 'Kosong di sumber' : rupiah(f.value)}</TableCell></TableRow>)}<TableRow><TableCell><strong>{detail.sourceTotal === null ? 'Jumlah fee terisi' : 'Total sumber'}</strong></TableCell><TableCell className={styles.money}><strong>{rupiah(detail.total)}</strong></TableCell></TableRow></TableBody></Table>
      {detail.extras.length > 0 && <><h3>Catatan tambahan sumber</h3><p className={styles.muted}>Nilai di luar Total Estimasi disimpan apa adanya dan belum menggantikan total utama.</p><Table><TableHeader><TableRow><TableHead>Sel sumber</TableHead><TableHead>Nilai</TableHead></TableRow></TableHeader><TableBody>{detail.extras.map(extra => <TableRow key={extra.cell}><TableCell>{extra.cell} · {extra.label}{extra.formula && <div className={styles.rowmeta}>{extra.formula}</div>}</TableCell><TableCell>{typeof extra.value === 'number' ? rupiah(extra.value) : extra.value}</TableCell></TableRow>)}</TableBody></Table></>}
    </>}</div></DialogContent></Dialog>
  </section>;
}
