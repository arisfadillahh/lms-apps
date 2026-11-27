'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ManualComponent, PayrollLine, Slip } from '@/lib/payroll/model';
import { payrollSessionLabel, rupiah } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

export default function PayrollDetailSummary({ slip, draft, busy, manual, edit, correct, inspect, remove }: {
  slip: Slip; draft: boolean; busy: boolean; manual: ManualComponent[];
  edit: (entry: ManualComponent) => void; correct: (line: PayrollLine) => void;
  inspect: (kind: string, label: string) => void; remove: (id: string) => void;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  const components = new Map(manual.map(entry => [`component:${entry.id}`, entry]));
  const storedLines = new Map(slip.lines.map(line => [line.key, line]));
  const awaitingCalculation = new Set<string>();
  const lines = draft ? slip.lines.filter(line => line.kind !== 'ADJUSTMENT' || !line.key.startsWith('component:')) : slip.lines;
  if (draft) for (const [key, entry] of components) {
    const applied = storedLines.get(key);
    if (!applied || applied.amount !== entry.amount || applied.label !== entry.label || applied.date !== entry.date) awaitingCalculation.add(key);
    lines.push({ key, label: entry.label, kind: 'ADJUSTMENT', quantity: 1, amount: entry.amount, rate: entry.amount, date: entry.date, details: entry.reason });
  }
  const groups = new Map<string, { label: string; kind: string; quantity: number; amount: number; line?: PayrollLine; pending: boolean }>();
  for (const line of lines) {
    const individual = line.summary || ['SALARY','ALLOWANCE','ADJUSTMENT'].includes(line.kind);
    const label = individual ? line.label : payrollSessionLabel(slip, line);
    const key = individual ? line.key : `${line.kind}:${label}`;
    const group = groups.get(key) ?? { label, kind: line.kind, quantity: 0, amount: 0, line: individual ? line : undefined, pending: line.kind === 'SALARY' && line.amount === 0 };
    group.quantity += line.fee_eligible===false || line.details.includes('dibatalkan') ? 0 : line.quantity; group.amount += line.amount; group.pending ||= Boolean(line.amount_pending && line.quantity);
    groups.set(key,group);
  }
  const all = [...groups.values()].sort((a,b) => a.label.localeCompare(b.label, 'id', { numeric: true }));
  const visible = all.filter(r => showEmpty || r.quantity !== 0 || r.amount !== 0), empty = all.length-visible.length;
  return <>
    <div className={styles.detailTotal}><span>Total periode</span><strong>{rupiah(slip.total)}</strong></div>
    <Table className={styles.detailSummaryTable}>
      <TableHeader><TableRow>
        <TableHead>Aktivitas / komponen</TableHead>
        <TableHead>Jumlah</TableHead>
        <TableHead>Nominal</TableHead>
        {draft && <TableHead><span className="sr-only">Tindakan</span></TableHead>}
      </TableRow></TableHeader>
      <TableBody>{visible.map(row => {
        const { line } = row;
        const component = line && components.get(line.key);
        const isSession = ['WEEKLY', 'EKSKUL', 'TRIAL'].includes(row.kind);
        return <TableRow key={line?.key ?? `${row.kind}:${row.label}`}>
          <TableCell>
            <strong>{row.label}</strong>
            {line && awaitingCalculation.has(line.key) && <div className={styles.rowmeta}>Belum masuk total rekap</div>}
            {line?.override_reason && <div className={styles.rowmeta}>Koreksi: {line.override_reason}</div>}
          </TableCell>
          <TableCell>{row.kind === 'GOAL' && row.quantity > 0 ? `${row.quantity} anak` : row.quantity && !['SALARY','ALLOWANCE','ADJUSTMENT','TRANSPORT'].includes(row.kind) ? `${row.quantity} ${isSession || row.kind === 'CLASS_SUMMARY' ? 'sesi' : 'kegiatan'}` : '—'}</TableCell>
          <TableCell className={styles.money}>{row.pending ? 'Belum diisi' : rupiah(row.amount)}</TableCell>
          {draft && <TableCell>
            {line?.summary && <Button data-correction-key={line.key} variant="ghost" size="sm" disabled={busy} onClick={() => correct(line)}>{isSession || row.kind === 'CLASS_SUMMARY' ? 'Ubah sesi' : 'Ubah jumlah'}</Button>}
            {!line && <Button variant="ghost" size="sm" disabled={busy} onClick={() => inspect(row.kind, row.label)}>{isSession ? 'Koreksi' : 'Koreksi kegiatan'}</Button>}
            {component && (component.id.startsWith('reimbursement:')
              ? <span className={styles.rowmeta}>Kelola di Reimbursement</span>
              : <>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => edit(component)}>Ubah</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => remove(component.id)}>Hapus</Button>
              </>)}
          </TableCell>}
        </TableRow>;
      })}</TableBody>
    </Table>
    {!visible.length && <p className={styles.muted}>Belum ada aktivitas atau penghasilan tercatat.</p>}
    {(empty > 0 || showEmpty) && <Button className={styles.emptyToggle} variant="ghost" size="sm" onClick={() => setShowEmpty(!showEmpty)}>{showEmpty ? 'Sembunyikan komponen kosong' : `Tampilkan ${empty} komponen kosong`}</Button>}
  </>;
}
