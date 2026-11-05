'use client';
import type { PayrollLine, PayrollPerson } from '@/lib/payroll/model';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import styles from './PayrollAdmin.module.css';

export default function PayrollCorrection({ line, people, profileId, busy, save, close }: {
  line: PayrollLine; people: PayrollPerson[]; profileId: string; busy: boolean;
  save: (extra: Record<string, unknown>) => void; close: () => void;
}) {
  return <form aria-label="Koreksi aktivitas" onSubmit={e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget));
    save({ sourceKey: line.key, profileId: f.profileId, mode: f.mode,
      amount: f.amount === '' ? undefined : Number(f.amount), excluded: f.excluded === 'on', reason: f.reason });
  }}><fieldset className={styles.form} disabled={busy}><legend>Koreksi: {line.label}</legend>
    <label className={styles.field}>Coach penerima fee<select className={styles.select} name="profileId" defaultValue={profileId}>{people.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {!line.summary && <label className={styles.field}>Mode untuk sesi ini<select className={styles.select} name="mode" defaultValue={line.mode ?? 'MITRA'}><option value="MITRA">Mitra — fee sesi</option><option value="FULLTIME">Fulltime — gaji tetap</option></select></label>}
    <label className={styles.field}>Nominal paksa (kosong = hitung sesuai tarif)<Input name="amount" type="number" min="0" step="1" placeholder={String(line.amount)} /></label>
    <label className={styles.checklabel}><input className={styles.checkbox} name="excluded" type="checkbox" />Batalkan hak fee untuk aktivitas ini</label>
    <label className={`${styles.field} ${styles.wide}`}>Alasan koreksi / force majeure<Input name="reason" minLength={5} maxLength={1000} required /></label>
    <p className={`${styles.muted} ${styles.wide}`}>Nominal paksa mengesampingkan tarif dan pembatalan. Setelah disimpan, klik Hitung ulang. Perubahan dicatat dalam audit.</p>
    <Button type="submit">Simpan koreksi aktivitas</Button><Button type="button" variant="ghost" onClick={close}>Batal koreksi</Button>
  </fieldset></form>;
}
