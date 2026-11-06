'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PayrollSettings } from '@/lib/payroll/model';
import styles from './PayrollAdmin.module.css';

export default function PayrollAutomation({ settings, busy, save }: { settings: PayrollSettings; busy: boolean; save: (extra: Record<string,unknown>) => Promise<boolean> }) {
  const [advanced,setAdvanced]=useState(!settings.active_from);
  return <section className={styles.panel} aria-label="Status otomatisasi">
    <div className={styles.automationStatus}>
      <div><h2>{!settings.active_from ? 'Tanggal mulai belum diatur' : settings.automation_enabled ? 'WA otomatis aktif' : 'WA otomatis dijeda'}</h2><p className={styles.muted}>Rekap tanggal 25, 09.00 WIB · Pengingat 16.00 WIB</p></div>
      <Button type="button" variant="outline" disabled={busy || !settings.active_from} onClick={()=>void save({activeFrom:settings.active_from,automationEnabled:!settings.automation_enabled})}>{settings.automation_enabled ? 'Jeda WA otomatis' : 'Aktifkan WA otomatis'}</Button>
    </div>
    <p className={styles.muted}>Pencatatan dan perhitungan tetap otomatis saat WA dijeda. Slip gaji dikirim manual setelah transfer.</p>
    <details className={styles.disclosure} open={advanced} onToggle={event=>setAdvanced(event.currentTarget.open)}><summary>Pengaturan lanjutan</summary>
      <form onSubmit={event=>{event.preventDefault();const fields=new FormData(event.currentTarget);void save({activeFrom:fields.get('activeFrom'),automationEnabled:settings.automation_enabled});}}>
        <fieldset className={styles.automationDate} disabled={busy}><label className={styles.field}>Tanggal mulai pencatatan<Input name="activeFrom" type="date" defaultValue={settings.active_from ?? ''} required /></label><p className={styles.muted}>Diatur sekali saat mulai memakai payroll. Periode berganti otomatis tanggal 26; tanggal ini tidak perlu diganti setiap bulan.</p><Button type="submit" variant="outline">Simpan tanggal mulai</Button></fieldset>
      </form>
    </details>
  </section>;
}
