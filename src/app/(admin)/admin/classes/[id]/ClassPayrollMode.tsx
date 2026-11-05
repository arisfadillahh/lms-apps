'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import styles from '../../payroll/PayrollAdmin.module.css';

export default function ClassPayrollMode({ classId, mode }: { classId: string; mode: 'MITRA' | 'FULLTIME' | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [selected, setSelected] = useState(mode ?? ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
    <span>Mode mengajar: <strong>{mode === 'MITRA' ? 'Mitra — fee per sesi' : mode === 'FULLTIME' ? 'Fulltime — gaji tetap' : 'Belum ditetapkan'}</strong></span>
    <Button size="sm" variant="ghost" onClick={() => { setSelected(mode ?? ''); setError(''); setOpen(true); }}>Ubah mode</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className={`${styles.modal} ${styles.formModal}`}><DialogHeader className={styles.modalHeader}><DialogTitle>Mode mengajar kelas</DialogTitle><DialogDescription>Tentukan apakah kelas ini termasuk gaji tetap atau mendapat fee per sesi untuk coach fulltime. Coach mitra selalu mendapat fee mitra.</DialogDescription></DialogHeader>
      <form className={styles.modalBody} onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError('');
        try {
          const response = await fetch(`/api/admin/classes/${classId}/payroll-mode`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: selected }) });
          const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Gagal menyimpan mode kelas.');
          setOpen(false); router.refresh();
        } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan mode kelas.'); }
        finally { setBusy(false); }
      }}>
        <label className={styles.field}>Mode mengajar<select aria-label="Mode mengajar" className={styles.select} required disabled={busy} value={selected} onChange={e => setSelected(e.target.value)}><option value="" disabled>Pilih mode</option><option value="MITRA">Mitra — mendapat fee per sesi</option><option value="FULLTIME">Fulltime — termasuk gaji tetap</option></select></label>
        <p className="text-sm text-muted-foreground">Rekap yang masih draf mengikuti perubahan setelah dihitung ulang. Koreksi khusus satu sesi tetap melalui rincian absensi.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={busy || !selected}>{busy ? 'Menyimpan…' : 'Simpan mode'}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>;
}
