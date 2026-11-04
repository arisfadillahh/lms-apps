'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PayrollTerm } from '@/lib/payroll/model';
import styles from './PayrollAdmin.module.css';

export default function PayrollAllowanceFields({ term }: { term?: PayrollTerm }) {
  const [others, setOthers] = useState(() => term?.other_allowances ?? []);
  return <div className={`${styles.wide} ${styles.allowanceFields}`}>
    <div><h3>Tunjangan rutin bulanan</h3><p className={styles.muted}>Otomatis masuk tiap periode sesuai tanggal berlaku. Tambahan/potongan khusus bulan tertentu diatur melalui Rincian penerima.</p></div>
    <label className={styles.field}>Tunjangan jabatan<Input name="positionAllowance" type="number" min="0" step="1" defaultValue={term?.position_allowance ?? 0} required /></label>
    <input type="hidden" name="otherAllowances" value={JSON.stringify(others)} />
    {others.map((item, index) => <div key={index} className={styles.allowanceRow}>
      <label className={styles.field}>Nama tunjangan lainnya<Input aria-label={`Nama tunjangan ${index + 1}`} value={item.label} maxLength={160} required onChange={e => setOthers(rows => rows.map((r, i) => i === index ? { ...r, label: e.target.value } : r))} /></label>
      <label className={styles.field}>Nominal per bulan<Input aria-label={`Nominal tunjangan ${index + 1}`} type="number" min="0" step="1" value={item.amount} required onChange={e => setOthers(rows => rows.map((r, i) => i === index ? { ...r, amount: Number(e.target.value) } : r))} /></label>
      <Button type="button" variant="ghost" aria-label={`Hapus tunjangan ${index + 1}`} onClick={() => setOthers(rows => rows.filter((_, i) => i !== index))}>Hapus</Button>
    </div>)}
    <Button type="button" variant="outline" disabled={others.length >= 20} onClick={() => setOthers(rows => [...rows, { label: '', amount: 0 }])}>Tambah tunjangan rutin lainnya</Button>
  </div>;
}
