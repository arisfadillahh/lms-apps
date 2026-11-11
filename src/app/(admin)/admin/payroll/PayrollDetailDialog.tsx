'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { isPaid, type PayrollLine, type PayrollMeeting, type PayrollPerson, type PeriodDocument, type Slip } from '@/lib/payroll/model';
import { dateWib, payrollCategory, rupiah } from '@/lib/payroll/presentation';
import PayrollCorrection from './PayrollCorrection';
import PayrollDetailSummary from './PayrollDetailSummary';
import styles from './PayrollAdmin.module.css';
import { attendanceStatusLabel,hasReasonedAttendanceOverride } from '@/lib/payroll/studentAttendanceState';

type View = 'overview' | 'component' | 'activity' | 'correction';
type Props = {
  period: PeriodDocument; slip: Slip; people: PayrollPerson[]; meetingCandidates: PayrollMeeting[]; busy: boolean;
  error: string; message: string; previewOpen: boolean;
  close: () => void; clearFeedback: () => void;
  run: (action: string, extra: Record<string, unknown>, success?: string) => Promise<boolean>;
  preview: (slip: Slip, version?: number) => void;
  resend: (kind: 'RECAP' | 'SLIP', profileId: string) => Promise<void>;
};

export default function PayrollDetailDialog({ period, slip, people, meetingCandidates, busy, error, message, previewOpen, close, clearFeedback, run, preview, resend }: Props) {
  const [view, setView] = useState<View>('overview');
  const [correction, setCorrection] = useState<PayrollLine | null>(null);
  const [sessionKind, setSessionKind] = useState<string | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null), alert = useRef<HTMLParagraphElement>(null);
  const sessions = useRef<HTMLDetailsElement>(null);
  const componentButton = useRef<HTMLButtonElement>(null), activityButton = useRef<HTMLButtonElement>(null);
  const previousView = useRef<View>('overview');
  const draft = period.status === 'DRAFT';
  const title = { overview: `Rincian ${slip.name}`, component: 'Tambahan / potongan', activity: 'Aktivitas manual', correction: 'Koreksi aktivitas' }[view];

  useEffect(() => {
    body.current?.scrollTo(0, 0);
    if (view !== 'overview') body.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    else if (previousView.current === 'correction') body.current?.querySelector<HTMLElement>(`[data-correction-key="${CSS.escape(correction?.key ?? '')}"]`)?.focus();
    else if (previousView.current !== 'overview') (previousView.current === 'activity' ? activityButton : componentButton).current?.focus();
  }, [view, correction?.key]);
  useEffect(() => {
    if (error) { body.current?.scrollTo(0, 0); alert.current?.focus(); }
  }, [error]);

  function changeView(next: View) {
    clearFeedback(); previousView.current = view; setView(next);
  }
  function correct(line: PayrollLine) {
    setCorrection(line); changeView('correction');
  }
  async function save(action: string, extra: Record<string, unknown>, success: string) {
    if (await run(action, extra, success)) { previousView.current = view; setView('overview'); }
  }
  function fields(event: FormEvent<HTMLFormElement>) { event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget)); }

  return <Dialog open onOpenChange={open => { if (!open && !previewOpen && !busy) close(); }}>
    <DialogContent className={`${styles.modal} ${view !== 'overview' ? styles.formModal : styles.recapModal}`} onEscapeKeyDown={event => {
      if (!previewOpen && view !== 'overview') { event.preventDefault(); if (!busy) changeView('overview'); }
    }}>
      <DialogHeader className={styles.modalHeader}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{view !== 'overview' && `${slip.name} · `}{new Date(period.year,period.month-1).toLocaleDateString('id-ID',{month:'long',year:'numeric'})} · {draft ? 'Rekap sementara' : 'Final'}</DialogDescription>
      </DialogHeader>
      <nav className={styles.detailTools} aria-label="Tindakan rincian">
        {view === 'overview' ? <>
          {draft && <><Button ref={componentButton} variant="outline" disabled={busy} onClick={() => changeView('component')}>Tambahan / potongan</Button><Button ref={activityButton} variant="outline" disabled={busy} onClick={() => changeView('activity')}>Aktivitas manual</Button></>}
          <Button variant="ghost" disabled={busy} onClick={() => preview(slip)}><FileText data-icon="inline-start" />Pratinjau slip</Button>
        </> : <Button variant="ghost" disabled={busy} onClick={() => changeView('overview')}><ArrowLeft data-icon="inline-start" />Kembali ke rincian</Button>}
      </nav>
      <div ref={body} className={styles.modalBody}>
        {view==='overview' && slip.lines.some(l=>['PENDING','PARTIAL'].includes(l.attendance_status ?? '') && !hasReasonedAttendanceOverride(period.overrides[l.key])) && <div className={styles.notice}>Ada absensi siswa yang belum lengkap. Lengkapi sebelum finalisasi. <Button variant="outline" size="sm" onClick={()=>{setSessionsOpen(true);setSessionKind(null);setTimeout(()=>sessions.current?.scrollIntoView({block:'start',behavior:'smooth'}),0);}}>Periksa sesi</Button></div>}
        {error && <p ref={alert} tabIndex={-1} role="alert" className={styles.error}>{error}</p>}
        {message && <p role="status" className={styles.success}>{message}</p>}
        {view === 'component' && draft && <form aria-label="Tambahan / potongan manual" onSubmit={event => {
          const f = fields(event);
          void save('component', { profileId: slip.profile_id, date: f.date, label: f.label, amount: Number(f.amount), reason: f.reason }, 'Komponen disimpan dan total diperbarui.');
        }}><fieldset className={styles.form} disabled={busy}>
          <p className={`${styles.muted} ${styles.wide}`}>Khusus periode ini. Nominal negatif menjadi potongan; tunjangan rutin diatur lewat profil staf.</p>
          <label className={styles.field}>Tanggal<Input name="date" type="date" defaultValue={`${period.id}-25`} required /></label>
          <label className={styles.field}>Label<Input name="label" placeholder="Transport / tunjangan / potongan" required /></label>
          <label className={styles.field}>Nominal (negatif untuk potongan)<Input name="amount" type="number" step="1" required /></label>
          <label className={styles.field}>Alasan<Input name="reason" minLength={5} required /></label>
          <Button type="submit">Simpan komponen</Button>
        </fieldset></form>}
        {view === 'activity' && draft && <form aria-label="Aktivitas tambahan" onSubmit={event => {
          const f = fields(event);
          void save('activity', { profileId: slip.profile_id, date: f.date, label: f.label, kind: f.kind, mode: f.mode, delivery: f.delivery, students: Number(f.students), reason: f.reason }, 'Aktivitas disimpan dan total diperbarui.');
        }}><fieldset className={styles.form} disabled={busy}>
          <p className={`${styles.muted} ${styles.wide}`}>Catat hanya aktivitas yang belum ada, termasuk laporan lewat tanggal 25. Kalau aktivitas sudah tercatat, gunakan Koreksi aktivitas agar tidak dihitung ganda. Absensi trial normal berasal dari penilaian trial.</p>
          <label className={styles.field}>Tanggal<Input name="date" type="date" defaultValue={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })} required /></label>
          <label className={styles.field}>Aktivitas<select name="kind" className={styles.select}><option value="WEEKLY">Weekly — aktivitas terlewat</option><option value="EKSKUL">Ekskul — aktivitas terlewat</option><option value="EVENT">Event</option><option value="TRAINING_ONLINE">Training online</option><option value="TRAINING_OFFLINE">Training offline</option><option value="OBSERVATION_ONLINE">Observasi online</option><option value="OBSERVATION_OFFLINE">Observasi offline</option><option value="TRIAL">Trial — pengecualian admin</option></select></label>
          <label className={styles.field}>Mode mengajar<select name="mode" className={styles.select}><option value="MITRA">Mitra</option><option value="FULLTIME">Fulltime</option></select></label>
          <label className={styles.field}>Pelaksanaan<select name="delivery" className={styles.select}><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option></select></label>
          <label className={styles.field}>Jumlah anak<Input name="students" type="number" min={1} max={500} defaultValue={1} required /></label>
          <label className={styles.field}>Nama kegiatan<Input name="label" required /></label>
          <label className={`${styles.field} ${styles.wide}`}>Alasan / referensi<Input name="reason" minLength={5} required /></label>
          <Button type="submit">Catat aktivitas</Button>
        </fieldset></form>}
        {view === 'correction' && draft && correction && <PayrollCorrection key={correction.key} line={correction} people={people} profileId={slip.profile_id} candidates={meetingCandidates} usedMeetingKeys={Object.entries(period.overrides).filter(([key]) => key !== correction.key).flatMap(([, entry]) => entry.meeting_keys ?? [])} override={period.overrides[correction.key]} busy={busy} close={() => changeView('overview')} save={extra => { void save('override', extra, 'Koreksi disimpan dan total diperbarui.'); }} />}
        {view === 'overview' && <section className={styles.detailPanel} aria-label={`Rincian ${slip.name}`}>
          <PayrollDetailSummary slip={slip} draft={draft} busy={busy} remove={id => { const reason = window.prompt('Alasan menghapus komponen:'); if (reason) void run('removeComponent', { id, reason }); }} correct={correct} inspect={kind => { setSessionKind(kind); setSessionsOpen(true); if (sessions.current) { sessions.current.open = true; sessions.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); sessions.current.querySelector('summary')?.focus(); } }} />
          {slip.lines.some(line => !line.summary && !['SALARY','ADJUSTMENT','ALLOWANCE'].includes(line.kind)) && <details ref={sessions} open={sessionsOpen} onToggle={event => setSessionsOpen(event.currentTarget.open)} className={styles.disclosure}><summary>{draft ? 'Pilih sesi yang perlu dikoreksi' : 'Detail sesi'}</summary>
          {sessionKind && <div className={styles.toolbar}><span>{payrollCategory(sessionKind)}</span><Button type="button" variant="ghost" size="sm" onClick={() => setSessionKind(null)}>Lihat semua aktivitas</Button></div>}
          <div className={styles.lines}><Table><TableHeader><TableRow><TableHead>Tanggal / aktivitas</TableHead><TableHead>Jenis & perhitungan</TableHead><TableHead>Nominal</TableHead><TableHead>Tindakan</TableHead></TableRow></TableHeader><TableBody>{slip.lines.filter(line => !line.summary && !['SALARY','ALLOWANCE','ADJUSTMENT'].includes(line.kind) && (!sessionKind || line.kind === sessionKind)).map(line => <TableRow key={line.key}>
            <TableCell>{dateWib(line.date)} WIB<div className={styles.rowname}>{line.label}</div>{line.attendance_status && <div>{attendanceStatusLabel(line) ?? 'Mengajar terkonfirmasi'} · {line.attendance_recorded}/{line.attendance_expected} absensi terisi</div>}<div className={styles.rowmeta}>{line.details}{line.override_reason && ` · Koreksi: ${line.override_reason}`}</div></TableCell>
            <TableCell><strong>{payrollCategory(line.kind)}</strong><div className={styles.rowmeta}>{line.mode === 'FULLTIME' ? 'Tercakup gaji pokok' : line.mode === 'MITRA' ? 'Fee mitra' : 'Komponen bulanan'}{line.students !== undefined && ['WEEKLY', 'EKSKUL', 'TRIAL'].includes(line.kind) && ` · ${line.students} anak`}</div></TableCell>
            <TableCell className={styles.money}>{rupiah(line.amount)}</TableCell><TableCell>{draft && !['SALARY', 'ADJUSTMENT', 'ALLOWANCE'].includes(line.kind) && <Button data-correction-key={line.key} size="sm" variant="outline" disabled={busy} onClick={() => correct(line)}>Koreksi sesi</Button>}</TableCell>
          </TableRow>)}</TableBody></Table></div></details>}
          {period.activities.filter(a => a.profile_id === slip.profile_id).map(a => <div key={a.id} className={styles.toolbar}><span>{a.label}</span>{draft && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { const reason = window.prompt('Alasan menghapus aktivitas manual:'); if (reason) void run('removeActivity', { id: a.id, reason }); }}>Hapus aktivitas</Button>}</div>)}
          <details className={styles.disclosure}><summary>Pengiriman ulang & riwayat penerima</summary><div className={styles.detailPanel}>
            <p className={styles.muted}>Rekap absensi dijadwalkan otomatis tanggal 25. Gunakan pengiriman manual hanya untuk koreksi atau kendala pengiriman.</p>
            <div className={styles.toolbar}>{slip.kind === 'COACH' && <Button variant="outline" disabled={busy || !period.calculated_at} onClick={() => { void resend('RECAP', slip.profile_id); }}>Kirim ulang rekap (manual)</Button>}<Button variant="outline" disabled={busy || !isPaid(period, slip.profile_id) || draft} onClick={() => { void resend('SLIP', slip.profile_id); }}>Kirim ulang slip final</Button></div>
            <h2>Versi final tersimpan</h2><div className={styles.toolbar}>{period.history.map(h => <Button variant="outline" size="sm" key={h.version} onClick={() => preview(slip, h.version)}>Versi {h.version} · {dateWib(h.finalized_at)} WIB</Button>)}</div>
            <h2>Riwayat transfer</h2>{period.transfers.filter(t => t.profile_id === slip.profile_id).map(t => { const reversed = period.transfer_reversals?.find(r => r.transfer_id === t.id); return <div key={t.id} className={styles.toolbar}><span className={styles.muted}>{dateWib(t.at)} WIB · {rupiah(t.amount)} · versi {t.version} {t.reference}{reversed && ` · Dibatalkan: ${reversed.reason}`}</span>{!draft && !reversed && <Button size="sm" variant="outline" disabled={busy} onClick={() => { const reason = window.prompt('Alasan membatalkan penandaan transfer (uang bank tidak dibatalkan):'); if (reason) void run('reverseTransfer', { transferId: t.id, reason }, 'Penandaan dibatalkan. Riwayat asli tetap tersimpan.'); }}>Batalkan penandaan</Button>}</div>; })}
          </div></details>
        </section>}
      </div>
    </DialogContent>
  </Dialog>;
}
