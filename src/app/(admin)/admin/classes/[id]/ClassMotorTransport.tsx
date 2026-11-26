'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MOTOR_TRIP_RATE } from '@/lib/payroll/transport';
import styles from '../../payroll/PayrollAdmin.module.css';

export default function ClassMotorTransport({ classId, coachId, coachName, enabled }: {
  classId: string;
  coachId: string;
  coachName: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rate = `Rp${MOTOR_TRIP_RATE.toLocaleString('id-ID')}`;

  return <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
    <span>Transport motor otomatis <strong>{enabled ? `Aktif · ${rate}/sesi` : 'Nonaktif'}</strong></span>
    <Button size="sm" variant="ghost" onClick={() => { setSelected(enabled); setError(''); setOpen(true); }}>Atur transport motor</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className={`${styles.modal} ${styles.formModal}`}>
        <DialogHeader className={styles.modalHeader}>
          <DialogTitle>Transport motor kelas</DialogTitle>
          <DialogDescription>{rate} masuk ke rekap {coachName} setelah sesi offline selesai dan absensi mengajar terkonfirmasi.</DialogDescription>
        </DialogHeader>
        <form aria-label="Pengaturan transport motor" className={styles.modalBody} onSubmit={async event => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            const response = await fetch(`/api/admin/classes/${classId}/motor-transport`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ coachId, enabled: selected }),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Gagal menyimpan transport motor.');
            setOpen(false);
            router.refresh();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Gagal menyimpan transport motor.');
          } finally { setBusy(false); }
        }}>
          <label className={styles.checklabel}><input type="checkbox" checked={selected} disabled={busy} className={styles.checkbox} onChange={event => setSelected(event.target.checked)} /> Aktifkan transport motor otomatis untuk {coachName}</label>
          <p className="my-3 text-sm text-muted-foreground">Berlaku untuk sesi setelah disimpan. Untuk coach pengganti atau pengecualian, gunakan Koreksi sesi di Absensi &amp; Gaji.</p>
          {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={busy || selected === enabled}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
