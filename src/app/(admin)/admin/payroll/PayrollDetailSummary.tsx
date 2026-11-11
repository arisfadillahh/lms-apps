'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PayrollLine, Slip } from '@/lib/payroll/model';
import { payrollCategory, rupiah } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

export default function PayrollDetailSummary({ slip, draft, busy, correct, inspect, remove }: { slip: Slip; draft: boolean; busy: boolean; correct: (line: PayrollLine) => void; inspect: (kind: string) => void; remove: (id: string) => void }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const groups = new Map<string, { label: string; kind: string; quantity: number; amount: number; line?: PayrollLine; pending: boolean }>();
  for (const line of slip.lines) {
    const key = line.summary || ['SALARY','ALLOWANCE','ADJUSTMENT'].includes(line.kind) ? line.key : line.kind;
    const group = groups.get(key) ?? { label: line.summary || ['SALARY','ALLOWANCE','ADJUSTMENT'].includes(line.kind) ? line.label : payrollCategory(line.kind), kind: line.kind, quantity: 0, amount: 0, line: line.summary || ['SALARY','ALLOWANCE','ADJUSTMENT'].includes(line.kind) ? line : undefined, pending: line.kind === 'SALARY' && line.amount === 0 };
    group.quantity += line.fee_eligible===false || line.details.includes('dibatalkan') ? 0 : line.quantity; group.amount += line.amount; group.pending ||= Boolean(line.amount_pending && line.quantity);
    groups.set(key,group);
  }
  const all = [...groups.values()], visible = all.filter(r => showEmpty || r.quantity !== 0 || r.amount !== 0), empty = all.length-visible.length;
  return <>
    <div className={styles.detailTotal}><span>Total periode</span><strong>{rupiah(slip.total)}</strong></div>
    <Table className={styles.detailSummaryTable}><TableHeader><TableRow><TableHead>Aktivitas / komponen</TableHead><TableHead>Jumlah</TableHead><TableHead>Nominal</TableHead>{draft && <TableHead><span className="sr-only">Tindakan</span></TableHead>}</TableRow></TableHeader><TableBody>{visible.map((row,i) => <TableRow key={i}><TableCell><strong>{row.label}</strong>{row.line?.override_reason && <div className={styles.rowmeta}>Koreksi: {row.line.override_reason}</div>}</TableCell><TableCell>{row.kind === 'GOAL' && row.quantity > 0 ? `${row.quantity} anak` : row.quantity && !['SALARY','ALLOWANCE','ADJUSTMENT','TRANSPORT'].includes(row.kind) ? `${row.quantity} ${['CLASS_SUMMARY','WEEKLY','EKSKUL','TRIAL'].includes(row.kind) ? 'sesi' : 'kegiatan'}` : '—'}</TableCell><TableCell className={styles.money}>{row.pending ? 'Belum diisi' : rupiah(row.amount)}</TableCell>{draft && <TableCell>{row.line?.summary && <Button data-correction-key={row.line.key} variant="ghost" size="sm" disabled={busy} onClick={() => correct(row.line!)}>{['CLASS_SUMMARY', 'WEEKLY', 'EKSKUL', 'TRIAL'].includes(row.kind) ? 'Ubah sesi' : 'Ubah jumlah'}</Button>}{!row.line && <Button variant="ghost" size="sm" disabled={busy} onClick={() => inspect(row.kind)}>{['WEEKLY', 'EKSKUL', 'TRIAL'].includes(row.kind) ? 'Pilih sesi' : 'Pilih kegiatan'}</Button>}{row.line?.kind === 'ADJUSTMENT' && (row.line.key.startsWith('component:reimbursement:') ? <span className={styles.rowmeta}>Kelola di Reimbursement</span> : <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(row.line!.key.slice(10))}>Hapus</Button>)}</TableCell>}</TableRow>)}</TableBody></Table>
    {!visible.length && <p className={styles.muted}>Belum ada aktivitas atau penghasilan tercatat.</p>}
    {(empty > 0 || showEmpty) && <Button className={styles.emptyToggle} variant="ghost" size="sm" onClick={() => setShowEmpty(!showEmpty)}>{showEmpty ? 'Sembunyikan komponen kosong' : `Tampilkan ${empty} komponen kosong`}</Button>}
  </>;
}
