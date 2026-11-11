'use client';

import { useState } from 'react';
import type { ActivityOverride, PayrollLine, PayrollMeeting, PayrollPerson } from '@/lib/payroll/model';
import { meetingMatchesLine, selectedMeetingKeys } from '@/lib/payroll/attendanceDetails';
import { dateWib, rupiah } from '@/lib/payroll/presentation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import styles from './PayrollAdmin.module.css';
import { attendanceStatusLabel } from '@/lib/payroll/studentAttendanceState';

type CorrectionLine = Pick<PayrollLine, 'key' | 'date' | 'label' | 'kind' | 'quantity' | 'mode' | 'students' | 'source_identity' | 'source_counter' | 'attendance_status' | 'summary_before'> & Partial<Pick<PayrollLine, 'rate' | 'quantity_rate' | 'amount' | 'summary' | 'override_reason'>>;
type OperationalOverride = Pick<ActivityOverride, 'profile_id' | 'excluded' | 'mode' | 'quantity' | 'meeting_keys' | 'selection_cutoff' | 'teaching_confirmed'> & { reason?: string };
type Props = {
  line: CorrectionLine; people: Pick<PayrollPerson, 'id' | 'user_id' | 'name' | 'active'>[]; profileId: string;
  busy: boolean; candidates?: PayrollMeeting[]; usedMeetingKeys?: string[]; override?: OperationalOverride & { amount?: number }; attendanceOnly?: boolean;
  save: (extra: Record<string, unknown>) => void; close: () => void;
};

function unit(kind: string) { return kind === 'GOAL' ? 'anak' : ['CLASS_SUMMARY', 'WEEKLY', 'EKSKUL', 'TRIAL'].includes(kind) ? 'sesi' : 'kegiatan'; }
export default function PayrollCorrection({ line, people, profileId, busy, candidates = [], usedMeetingKeys = [], override, attendanceOnly = false, save, close }: Props) {
  const summary = Boolean(line.summary || !line.date);
  const canChooseMeetings = summary && !['GOAL', 'TRANSPORT'].includes(line.kind);
  const initialQuantity = summary && override?.excluded ? 0 : line.quantity;
  const [recipient, setRecipient] = useState(override?.profile_id ?? profileId);
  const initialMode = override?.mode ?? line.mode ?? 'MITRA';
  const [mode, setMode] = useState(initialMode);
  const [method, setMethod] = useState<'quantity' | 'meetings'>(override?.meeting_keys && !override.excluded ? 'meetings' : 'quantity');
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [selected, setSelected] = useState<string[]>(() => override?.excluded ? [] : selectedMeetingKeys(override,candidates,line,people.find(p=>p.id===recipient)?.user_id));
  const [excluded, setExcluded] = useState(override?.excluded ?? false);
  const [teaching,setTeaching]=useState(override?.teaching_confirmed===undefined?'AUTO':String(override.teaching_confirmed));
  const [manualAmount, setManualAmount] = useState(override?.amount !== undefined);
  const [amount, setAmount] = useState(override?.amount === undefined ? '' : String(override.amount));
  const person = people.find(p => p.id === recipient);
  const meetings = candidates.filter(m => m.user_id === person?.user_id && meetingMatchesLine(m, line)).sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  const available = meetings.filter(m => !m.cancelled && !(m.attendance_status && m.fee_eligible===false) && !usedMeetingKeys.includes(m.key)), availableKeys = new Set(available.map(m => m.key));
  const selectedAvailable = selected.filter(key => availableKeys.has(key));
  const count = summary ? method === 'meetings' ? selectedAvailable.length : Number(quantity) : excluded ? 0 : 1;
  const nativeCalculationChanged = !summary && (teaching !== (override?.teaching_confirmed===undefined?'AUTO':String(override.teaching_confirmed)) || recipient !== (override?.profile_id ?? profileId) || mode !== initialMode || excluded !== (override?.excluded ?? false) || (!manualAmount && override?.amount !== undefined));
  const automaticAmount = summary ? Math.round(count * (line.quantity_rate ?? line.rate ?? 0)) : excluded ? 0 : line.amount ?? 0;
  const label = unit(line.kind);
  const invalidCount = !Number.isSafeInteger(count) || count < 0 || count > 10000;
  const hasFinancials = !attendanceOnly && line.amount !== undefined;
  const unavailableSelected = selected.some(key => !availableKeys.has(key));
  const needsSelection = summary && method === 'meetings' && selectedAvailable.length === 0;

  return <form aria-label="Koreksi aktivitas" className={styles.correctionForm} onSubmit={event => {
    event.preventDefault();
    if (invalidCount || needsSelection || (method === 'meetings' && unavailableSelected)) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const extra: Record<string, unknown> = { sourceKey: line.key, profileId: recipient, mode: summary ? undefined : mode, excluded: summary ? count === 0 : excluded, reason: fields.reason };
    if (summary) {
      extra.quantity = count;
      if (method === 'meetings') extra.meetingKeys = selectedAvailable;
    }
    if (!attendanceOnly) extra.amount = manualAmount ? Number(amount) : undefined;
    if(!summary && ['WEEKLY','EKSKUL'].includes(line.kind))extra.teachingConfirmed=teaching==='AUTO'?undefined:teaching==='true';
    save(extra);
  }}><fieldset className={styles.correctionFields} disabled={busy}>
    <legend className="sr-only">Koreksi {line.label}</legend>
    <div className={styles.correctionHeading}><strong>{line.label}</strong><span>{summary ? `${initialQuantity} ${label} dihitung` : `${dateWib(line.date)} WIB`}</span></div>
    {line.attendance_status && <p className={styles.notice}>{attendanceStatusLabel(line) ?? 'Mengajar terkonfirmasi dari absensi siswa'}. Untuk pengecualian, gunakan Validasi sesi mengajar di Pengaturan lanjutan dan isi alasan.</p>}

    {summary ? <>
      {canChooseMeetings && <div className={styles.correctionMethod} role="group" aria-label="Cara koreksi">
        <Button type="button" variant={method === 'quantity' ? 'default' : 'ghost'} aria-pressed={method === 'quantity'} onClick={() => setMethod('quantity')}>Ubah jumlah</Button>
        <Button type="button" variant={method === 'meetings' ? 'default' : 'ghost'} aria-pressed={method === 'meetings'} onClick={() => setMethod('meetings')}>Pilih pertemuan</Button>
      </div>}
      {method === 'quantity' ? <div className={styles.correctionCount}>
        <label className={styles.field}>Jumlah {label} yang dihitung<Input name="quantity" aria-label={`Jumlah ${label} yang dihitung`} type="number" min={0} max={10000} step={1} value={quantity} onChange={event => setQuantity(event.target.value)} required /></label>
        <p className={styles.muted}>{hasFinancials ? manualAmount ? 'Jumlah berubah; nominal khusus tetap digunakan.' : 'Nominal mengikuti jumlah dan tarif yang berlaku.' : 'Jumlah ini menjadi dasar rekap absensi coach.'}</p>
      </div> : <section className={styles.meetingPicker} aria-label="Pilih pertemuan yang dihitung">
        <div className={styles.meetingPickerHeader}><p><strong>{selectedAvailable.length}</strong> pertemuan dipilih</p><Button type="button" size="sm" variant="ghost" disabled={!available.length && !selected.length} onClick={() => setSelected(unavailableSelected || selectedAvailable.length === available.length ? [] : available.map(m => m.key))}>{unavailableSelected ? 'Hapus pilihan lama' : selectedAvailable.length && selectedAvailable.length === available.length ? 'Lepas semua' : 'Pilih semua'}</Button></div>
        <p className={styles.meetingHint}>Centang pertemuan yang dihitung. Jumlah mengikuti pilihan ini.</p>
        {meetings.length ? <ul className={styles.meetingList}>{meetings.map(meeting => <li key={meeting.key}><label className={`${styles.meetingOption} ${!availableKeys.has(meeting.key) ? styles.meetingCancelled : ''}`}>
          <input className={styles.checkbox} type="checkbox" checked={selectedAvailable.includes(meeting.key)} disabled={!availableKeys.has(meeting.key)} onChange={event => setSelected(keys => event.target.checked ? [...keys.filter(k => availableKeys.has(k)), meeting.key] : keys.filter(key => key !== meeting.key))} />
          <span><strong>{meeting.label}</strong><span>{dateWib(meeting.date)} WIB · {meeting.delivery === 'ONLINE' ? 'Online' : 'Offline'}{meeting.students > 0 && ` · ${meeting.students} anak`}{meeting.cancelled && ' · Dibatalkan'}{usedMeetingKeys.includes(meeting.key) && ' · Sudah dihitung di kategori lain'}{meeting.substitute && ' · Coach pengganti'}</span></span>
        </label></li>)}</ul> : <p className={styles.muted}>Belum ada pertemuan bertanggal untuk kategori ini. Gunakan Ubah jumlah untuk memperbaiki rekapnya.</p>}
        {unavailableSelected && <p role="alert" className={styles.error}>Ada pilihan pertemuan yang sudah tidak tersedia. Pilih ulang pertemuannya sebelum menyimpan.</p>}
      </section>}
      {canChooseMeetings && initialQuantity > available.length && !override?.meeting_keys && <p className={styles.meetingIncomplete}>Baru {available.length} dari {initialQuantity} {label} punya detail tanggal yang dapat dipilih. Gunakan Ubah jumlah bila detailnya belum lengkap. Tanggal perlu dilengkapi sebelum rekap detail dikirim.</p>}
    </> : <label className={styles.field}>Pencatatan aktivitas<select className={styles.select} value={String(excluded)} onChange={event => { const next = event.target.value === 'true'; setExcluded(next); if (next) setManualAmount(false); }}><option value="false">Dihitung</option><option value="true">Tidak dihitung</option></select></label>}

    {hasFinancials && <div className={styles.correctionEstimate} aria-live="polite"><span>{manualAmount ? 'Nominal khusus' : 'Nominal otomatis'}</span><strong>{invalidCount ? '—' : !manualAmount && nativeCalculationChanged && !excluded ? 'Dihitung saat disimpan' : rupiah(manualAmount ? Number(amount) || 0 : automaticAmount)}</strong>{manualAmount ? <p>Nominal khusus sedang digunakan. Pilih tarif otomatis di Pengaturan lanjutan agar nominal mengikuti jumlah.</p> : nativeCalculationChanged && <p>Nominal mengikuti coach dan mode mengajar yang dipilih setelah disimpan.</p>}</div>}

    {!summary && <label className={styles.field}>Coach yang mengajar<select className={styles.select} value={recipient} onChange={event => { setRecipient(event.target.value); setSelected([]); }}>{people.filter(p => p.active || p.id === recipient).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
    <label className={styles.field}>Alasan koreksi<Input name="reason" placeholder="Contoh: satu pertemuan dibatalkan" minLength={5} maxLength={1000} defaultValue={override?.reason ?? ''} required /></label>

    <details className={`${styles.disclosure} ${styles.correctionAdvanced}`}><summary>Pengaturan lanjutan</summary><div className={styles.correctionAdvancedFields}>
      {summary && <label className={styles.field}>Coach penerima<select className={styles.select} value={recipient} onChange={event => { setRecipient(event.target.value); setSelected([]); }}>{people.filter(p => p.active || p.id === recipient).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      {!summary && <label className={styles.field}>Mode mengajar<select className={styles.select} value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="MITRA">Mitra — fee sesi</option><option value="FULLTIME">Fulltime — gaji tetap</option></select></label>}
      {!summary && ['WEEKLY','EKSKUL'].includes(line.kind) && <label className={styles.field}>Validasi sesi mengajar<select className={styles.select} value={teaching} onChange={event=>setTeaching(event.target.value)}><option value="AUTO">Ikuti absensi siswa</option><option value="true">Pengecualian: sesi benar-benar diajar</option><option value="false">Pengecualian: sesi tidak berlangsung</option></select><span className={styles.muted}>Pengecualian wajib disertai alasan. Bukti absensi siswa tetap tersimpan.</span></label>}
      {!attendanceOnly && <>
        <label className={styles.field}>Perhitungan nominal<select className={styles.select} value={manualAmount ? 'manual' : 'automatic'} onChange={event => setManualAmount(event.target.value === 'manual')}><option value="automatic">Otomatis sesuai tarif</option><option value="manual">Nominal khusus</option></select></label>
        {manualAmount && <label className={styles.field}>Nominal khusus (Rp)<Input aria-label="Nominal khusus" type="number" min={0} step={1} value={amount} onChange={event => setAmount(event.target.value)} required /></label>}
        <p className={styles.muted}>Nominal khusus digunakan untuk pengecualian yang sudah disetujui.</p>
      </>}
    </div></details>
    <div className={styles.correctionFooter}><Button type="submit" disabled={invalidCount || needsSelection || (method === 'meetings' && unavailableSelected)}>{busy ? 'Menyimpan…' : 'Simpan koreksi'}</Button><Button type="button" variant="ghost" onClick={close}>Batal</Button><span>{needsSelection ? 'Pilih pertemuan dulu untuk menyimpan.' : attendanceOnly ? 'Absensi diperbarui setelah disimpan.' : 'Total dan rekap diperbarui setelah disimpan.'}</span></div>
  </fieldset></form>;
}
