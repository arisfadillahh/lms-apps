'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Send, RefreshCw, CheckCheck, FileText, Users, Settings, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DEFAULT_COACH_WORKING_DAYS, currentPeriod, effective, isPaid, paidAmount, type PayrollPerson, type Slip } from '@/lib/payroll/model';
import { dateWib, rupiah, payrollActivitySummary } from '@/lib/payroll/presentation';
import type { payrollBootstrap } from '@/lib/services/payroll';
import styles from './PayrollAdmin.module.css';
import CoachAttendance from '../coach-attendance/CoachAttendance';
import PayrollDetailDialog from './PayrollDetailDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PayrollPreviewDialog from './PayrollPreviewDialog';
import PayrollAllowanceFields from './PayrollAllowanceFields';
import PayrollPeople from './PayrollPeople';
import PayrollRates from './PayrollRates';
import PayrollAutomation from './PayrollAutomation';
import PayrollReimbursements from './PayrollReimbursements';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Data = Awaited<ReturnType<typeof payrollBootstrap>>;
async function fetchPayrollData(year: number, month: number): Promise<Data> {
  const response = await fetch(`/api/admin/payroll?year=${year}&month=${month}`, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Gagal memuat gaji.');
  return body;
}
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const deliveryLabels: Record<string, string> = { BELUM: 'Belum dikirim', SENT: 'Terkirim WA', FAILED: 'Gagal dikirim', LMS_ONLY: 'Terkirim di LMS', NO_CONTACT: 'Nomor WA belum ada', SENDING: 'Sedang dikirim', SIMULATED: 'Simulasi local' };
function PayrollReviewWarnings({ warnings }: { warnings: string[] }) {
  const attendance = warnings.filter(warning => warning.startsWith('Absensi siswa '));
  const mode = warnings.filter(warning => warning.startsWith('Pilih mode fulltime/mitra '));
  const other = warnings.filter(warning => !attendance.includes(warning) && !mode.includes(warning));
  const groups = [
    { label: 'Absensi siswa belum lengkap', count: 'absensi belum lengkap', entries: attendance.map(warning => warning.replace(/^Absensi siswa /, '').split('. Lengkapi absensi')[0]), instruction: 'Lengkapi presensi siswa atau buka Rincian → Koreksi sesi untuk mencatat hasil pemeriksaan.' },
    { label: 'Mode mengajar belum dipilih', count: 'mode mengajar belum dipilih', entries: mode.map(warning => warning.replace(/^Pilih mode fulltime\/mitra untuk /, '').replace(/ atau beri override beralasan\.$/, '')), instruction: 'Pilih Fulltime atau Mitra di kelas, atau koreksi mode untuk sesi tertentu melalui Rincian.' },
    { label: 'Pemeriksaan lain', count: 'perlu diperiksa', entries: other },
  ].filter(group => group.entries.length > 0);
  return <details className={`${styles.notice} ${styles.reviewWarnings}`}>
    <summary><strong>Periksa sebelum finalisasi</strong><span>{groups.map(group => `${group.entries.length} ${group.count}`).join(' · ')}</span></summary>
    <div className={styles.warningGroups}>
      {groups.map(group => <section key={group.label}>
        <h3>{group.label}</h3>
        {group.instruction && <p>{group.instruction}</p>}
        <ul>{group.entries.map((entry, index) => <li key={index}>{entry}</li>)}</ul>
      </section>)}
    </div>
  </details>;
}

export default function PayrollAdmin({ initialPeriod, initialTab }: { initialPeriod?: string; initialTab?: string }) {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const initial = /^20\d{2}-(0[1-9]|1[0-2])$/.test(initialPeriod ?? '') ? initialPeriod! : currentPeriod().id;
  const [year, setYear] = useState(Number(initial.slice(0, 4))), [month, setMonth] = useState(Number(initial.slice(5)));
  const [tab, setTab] = useState(initialTab === 'attendance' ? 'attendance' : 'period'), [data, setData] = useState<Data | null>(null), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]), [detail, setDetail] = useState<string | null>(null);
  const [search, setSearch] = useState(''), [kindFilter, setKindFilter] = useState('ALL'), [paidFilter, setPaidFilter] = useState('ALL'), [deliveryFilter, setDeliveryFilter] = useState('ALL');
  const [editing, setEditing] = useState<PayrollPerson | null>(null), [personKind, setPersonKind] = useState('COACH');
  const [newCoachId, setNewCoachId] = useState(''), [personContract, setPersonContract] = useState('');
  const personTerm = editing && data ? effective(data.terms.filter(t => t.profile_id === editing.id), today()) ?? data.terms.filter(t => t.profile_id === editing.id).sort((a,b) => a.effective_from.localeCompare(b.effective_from))[0] : undefined;
  const [workspace, setWorkspace] = useState<string | null>(null), [showFilters, setShowFilters] = useState(false), [personOpen, setPersonOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState('rates');
  const [preview, setPreview] = useState<{ slip: Slip; version: number } | null>(null);
  const record = data?.selected?.id === `${year}-${String(month).padStart(2, '0')}` ? data.selected : null, period = record?.document;
  const screen = workspace ?? (period?.status === 'FINAL' ? 'payment' : 'review');
  const filtersActive = kindFilter !== 'ALL' || paidFilter !== 'ALL' || deliveryFilter !== 'ALL';
  const canFinalize = Boolean(period?.calculated_at && Date.parse(period.calculated_at) >= Date.parse(period.ends_at) && !period.warnings.length && !(period.corrections ?? []).some(r => ['WAITING', 'IN_PROGRESS'].includes(r.status)));
  const load = useCallback(async () => {
    const body = await fetchPayrollData(year, month);
    setData(body); return body;
  }, [year, month]);
  useEffect(() => {
    let active = true;
    fetchPayrollData(year, month).then(body => { if (active) { setData(body); setWorkspace(null); setSelected([]); setDetail(null); setPreview(null); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [year, month]);
  async function post(action: string, extra: Record<string, unknown> = {}, revision = record?.revision) {
    const r = await fetch('/api/admin/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, periodId: record?.id, revision, ...extra }) });
    const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Tindakan gagal.'); return body.result;
  }
  async function reimbursementChanged() {
    const latest = await load();
    if (latest.selected?.document.status === 'DRAFT') {
      await post('calculate', {}, latest.selected.revision);
      await load();
    }
  }
  async function run(action: string, extra: Record<string, unknown> = {}, success = 'Perubahan tersimpan.') {
    setBusy(action); setError(''); setMessage('');
    try { const result = await post(action, extra); if (['component','removeComponent','activity','removeActivity','override'].includes(action)) await post('calculate', {}, result.revision); await load(); setMessage(success); if (action === 'profile') setPersonOpen(false); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Tindakan gagal.'); await load().catch(() => undefined); return false; }
    finally { setBusy(''); }
  }
  function delivery(s: Slip) { return period?.deliveries[`${s.profile_id}:${period.version}:SLIP`]?.status ?? 'BELUM'; }
  const visible = (period?.slips ?? []).filter(s =>
    (!search || `${s.name} ${s.job_title}`.toLowerCase().includes(search.toLowerCase())) &&
    (kindFilter === 'ALL' || s.kind === kindFilter || s.contract === kindFilter) &&
    (paidFilter === 'ALL' || (isPaid(period!, s.profile_id) ? 'PAID' : 'UNPAID') === paidFilter) &&
    (deliveryFilter === 'ALL' || delivery(s) === deliveryFilter));
  const focused = period?.slips.find(s => s.profile_id === detail);
  const unpaidSelected = period ? selected.filter(id => !isPaid(period, id)) : [];
  async function bulk(action: 'transfer' | 'send', kind?: 'RECAP' | 'SLIP', ids = selected, resend = false) {
    if (!ids.length) { setError('Pilih minimal satu penerima.'); return; }
    if (!window.confirm(action === 'transfer' ? 'Tandai sudah ditransfer hanya jika transfer bank benar-benar selesai. Lanjutkan?' : `${resend ? 'Kirim ulang' : 'Kirim'} ${kind === 'SLIP' ? 'slip final' : 'rekap absensi'} ke ${ids.length} penerima?`)) return;
    setBusy('Memproses'); setError(''); setMessage('');
    const outcomes: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += 10) {
        setBusy(`Memproses ${Math.min(i + 10, ids.length)}/${ids.length}`);
        const latest = await load();
        const result = await post(action, { profileIds: ids.slice(i, i + 10), kind, resend }, latest.selected?.revision);
        if (Array.isArray(result)) for (const r of result) outcomes.push(`${data?.people.find(p => p.id === r.profileId)?.name ?? r.profileId}: ${deliveryLabels[r.status] ?? r.status}${r.error ? ' — ' + r.error : ''}`);
      }
      await load();
      if (action === 'send') setSelected([]);
      setMessage(outcomes.join('\n') || (action === 'transfer' ? 'Transfer tercatat. Penerima tetap dipilih; lanjutkan dengan Kirim slip gaji.' : 'Pengiriman diproses.'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Sebagian tindakan gagal. Muat ulang dan periksa hasil.'); await load().catch(() => undefined); }
    finally { setBusy(''); }
  }
  function openPreview(slip: Slip, version = period?.version ?? 1) {
    if (!period) return;
    const saved = period.history.find(h => h.version === version)?.slips.find(s => s.profile_id === slip.profile_id);
    setPreview({ slip: saved ?? slip, version });
  }
  function formData(e: FormEvent<HTMLFormElement>) { e.preventDefault(); return Object.fromEntries(new FormData(e.currentTarget)); }
  function addPerson(kind: 'COACH' | 'STAFF' = 'STAFF', coachId = '') { setEditing(null); setPersonKind(kind); setNewCoachId(coachId); setPersonContract(''); setPersonOpen(true); setError(''); setMessage(''); }
  function editPerson(p: PayrollPerson) { const terms = data?.terms.filter(t => t.profile_id === p.id) ?? []; setPersonContract((effective(terms, today()) ?? terms.sort((a,b) => a.effective_from.localeCompare(b.effective_from))[0])?.contract ?? ''); setEditing(p); setPersonKind(p.kind); setTab('people'); setPersonOpen(true); setError(''); setMessage(''); }
  return <main className={styles.root}>
    <header className={styles.header}><h1 className={styles.title}>Absensi &amp; Gaji</h1><Button variant="ghost" size="icon" aria-label="Muat ulang" title="Muat ulang data" disabled={Boolean(busy)} onClick={() => { setBusy('Memuat'); load().catch(e => setError(e.message)).finally(() => setBusy('')); }}><RefreshCw /></Button></header>
    <nav className={styles.nav} aria-label="Bagian penggajian">{[['period', 'Rekap & arsip', Wallet], ['attendance', 'Absensi & koreksi', FileText], ['people', 'Coach & staf', Users], ['settings', 'Tarif & otomatisasi', Settings]].map(([id, label, Icon]) => <Button key={String(id)} variant={tab === id ? 'default' : 'ghost'} onClick={() => { setTab(String(id)); setError(''); setMessage(''); }} aria-current={tab === id ? 'page' : undefined}>{typeof Icon !== 'string' && <Icon data-icon="inline-start" />}{String(label)}</Button>)}</nav>
    {!detail && !personOpen && error && <p role="alert" className={styles.error}>{error}</p>}{!detail && !personOpen && message && <p role="status" className={styles.success} style={{ whiteSpace: 'pre-wrap' }}>{message}</p>}{busy && <p role="status" className={styles.progress}>{busy === 'refreshSource' || busy === 'calculate' ? 'Memperbarui rekap' : 'Memproses'}…</p>}
    {!data ? <p className={styles.loader}>Memuat penggajian…</p> : <>
    {!data.settings.active_from && !period?.legacy_imports?.length && <div className={styles.notice}>Mulai dari tab <strong>Coach &amp; staf</strong> untuk mengatur penerima/kontrak, lalu <strong>Tarif &amp; otomatisasi</strong> untuk tanggal mulai. Data gaji dan pengiriman tidak dibuat otomatis sebelum pengaturan diaktifkan.</div>}
    {tab === 'period' && <>
      <section className={`${styles.panel} ${styles.periodBar}`} aria-label="Pilih periode">
        <div className={styles.periodselect}><span className={styles.muted}>Periode</span><select aria-label="Bulan arsip" className={styles.select} value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{new Date(2026, i).toLocaleString('id-ID', { month: 'long' })}</option>)}</select><Input aria-label="Tahun arsip" type="number" min="2020" max="2099" value={year} onChange={e => setYear(Number(e.target.value))} />{period && <Badge variant={period.status === 'FINAL' ? 'default' : 'secondary'}>{period.id} · {period.status === 'FINAL' ? 'Final' : 'Draf'} · v{period.version}</Badge>}</div>
        <div className={styles.actions}><PayrollReimbursements key={`${year}-${month}`} periodId={`${year}-${String(month).padStart(2, '0')}`} canReview onChanged={reimbursementChanged} />{!period && <Button disabled={Boolean(busy)} onClick={() => run('create', { year, month }, 'Periode draft dibuat.')}>Buat periode</Button>}{tab === 'period' && period?.status === 'DRAFT' && <><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => run(period.legacy_imports?.length && period.id === currentPeriod().id ? 'refreshSource' : 'calculate', {}, 'Rekap diperbarui.')}>Perbarui rekap</Button><span title={canFinalize ? 'Simpan versi final periode ini' : `Finalisasi setelah ${dateWib(period.ends_at)} WIB; hitung ulang dan selesaikan peringatan dahulu.`}><Button size="sm" disabled={Boolean(busy) || !canFinalize} onClick={() => { if (window.confirm('Finalisasi menyimpan versi tetap. Pastikan seluruh tanggal 25 tercakup dan tidak ada peringatan.')) run('finalize', {}, 'Versi final tersimpan.'); }}>Finalisasi</Button></span></>}</div>
        {tab === 'period' && period?.status === 'DRAFT' && !canFinalize && <p className={styles.rowmeta} role="status">{(period.corrections ?? []).some(r => ['WAITING', 'IN_PROGRESS'].includes(r.status)) ? 'Finalisasi menunggu pengajuan koreksi diselesaikan oleh PIC.' : clock < Date.parse(period.ends_at) ? `Periode masih berjalan. Finalisasi mulai ${dateWib(period.ends_at)} WIB.` : period.warnings.length ? 'Selesaikan peringatan pada rekap sebelum finalisasi.' : 'Klik Perbarui rekap untuk melengkapi aktivitas sampai akhir periode.'}</p>}
        {period && <details className={`${styles.disclosure} ${styles.periodInfo}`}><summary>Info periode</summary><p className={styles.muted}>Aktivitas: {dateWib(period.starts_at)} WIB sampai akhir tanggal 25. Batas koreksi reguler: <strong>{dateWib(period.correction_deadline)} WIB</strong>. Admin tetap dapat merevisi setelah deadline. Aktivitas tanggal 26 masuk periode berikutnya. Pilih bulan/tahun di atas untuk membuka arsip.</p><p className={styles.muted}>{period.status === 'DRAFT' ? `Periksa aktivitas dan koreksi melalui Rincian. Rekap absensi dikirim otomatis tanggal 25. Finalisasi tersedia setelah ${dateWib(period.ends_at)} WIB, sesudah Perbarui rekap dan seluruh peringatan selesai.` : 'Di Pembayaran & slip, centang penerima setelah transfer bank selesai untuk menandai pembayaran, lalu kirim slip. Buka Riwayat periode untuk revisi admin.'}</p><p className={styles.muted}>Rekap otomatis tanggal 25 mulai 09.00 WIB, pengingat mulai 16.00 WIB, deadline koreksi 17.00 WIB. Status WA otomatis: <strong>{data.settings.automation_enabled ? 'Aktif' : 'Dijeda'}</strong>. Pengaturannya ada di Tarif &amp; otomatisasi → Otomatisasi.</p></details>}
      </section>
    </>}
    {tab === 'period' && <>
      {!period ? <div className={styles.empty}>Belum ada rekap pada periode ini. Pilih arsip lain atau buat periode baru.</div> : <>
      <Tabs value={screen} onValueChange={value => { setWorkspace(value); setSelected([]); setDetail(null); setPaidFilter('ALL'); setDeliveryFilter('ALL'); }} className={styles.workspace}>
        <div className={styles.workspaceBar}><TabsList className={styles.workspaceTabs} aria-label="Area kerja periode"><TabsTrigger value="review">Rekap penerima</TabsTrigger><TabsTrigger value="payment">Pembayaran &amp; slip</TabsTrigger><TabsTrigger value="history">Riwayat periode</TabsTrigger></TabsList>{screen !== 'history' && !(screen === 'payment' && period.status === 'DRAFT') && <div className={styles.tableTools}><Input aria-label="Cari penerima" placeholder="Nama atau jabatan" value={search} onChange={e => { setSearch(e.target.value); setSelected([]); }} /><Button variant="ghost" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}>{showFilters ? 'Tutup filter' : filtersActive ? 'Filter aktif' : 'Filter'}</Button></div>}</div>
        <TabsContent value={screen}>
      <>
      {screen === 'payment' && period.status === 'DRAFT' ? <section className={styles.panel}><h2>Finalisasi rekap terlebih dahulu</h2><p className={styles.muted}>Penanda transfer tersedia setelah periode final. Finalisasi periode ini dapat dilakukan setelah {dateWib(period.ends_at)} WIB, sesudah Perbarui rekap dan seluruh peringatan selesai.</p><ol className={styles.paymentSteps}><li>Periksa Rekap penerima, lalu Finalisasi.</li><li>Setelah transfer bank selesai, centang penerima dan klik <strong>Tandai sudah transfer</strong>.</li><li>Penerima tetap dipilih; lanjutkan dengan <strong>Kirim slip gaji</strong>.</li></ol></section> : screen !== 'history' && <section className={styles.panel}>
        <div className={styles.periodSummary} role="region" aria-label="Ringkasan hasil filter"><span><strong>{visible.length}</strong> penerima</span><span>Total <strong>{rupiah(visible.reduce((n, s) => n + s.total, 0))}</strong></span>{period.synchronized_at && <span>Data diperbarui <strong>{dateWib(period.synchronized_at)} WIB</strong></span>}{screen === 'review' && <span>WA tanggal 25: <strong>{data.settings.automation_enabled ? 'Aktif' : 'Dijeda'}</strong></span>}{screen === 'payment' && <><span>Ditransfer <strong>{rupiah(visible.reduce((n, s) => n + paidAmount(period, s.profile_id), 0))}</strong></span><span>Sisa <strong>{rupiah(visible.reduce((n, s) => n + Math.max(0, s.total - paidAmount(period, s.profile_id)), 0))}</strong></span></>}</div>
        {screen === 'review' && period.warnings.length > 0 && <PayrollReviewWarnings warnings={period.warnings} />}
        {showFilters && <div className={styles.filters}><label className={styles.field}>Kategori<select aria-label="Kategori penerima" className={styles.select} value={kindFilter} onChange={e => { setKindFilter(e.target.value); setSelected([]); }}><option value="ALL">Semua penerima</option><option value="COACH">Coach</option><option value="STAFF">Staf</option><option value="FULLTIME">Fulltime</option><option value="MITRA">Mitra</option></select></label>{screen === 'payment' && <><label className={styles.field}>Transfer<select aria-label="Status transfer" className={styles.select} value={paidFilter} onChange={e => { setPaidFilter(e.target.value); setSelected([]); }}><option value="ALL">Semua status</option><option value="PAID">Sudah ditransfer</option><option value="UNPAID">Belum selesai</option></select></label><label className={styles.field}>Slip WA<select aria-label="Status pengiriman slip" className={styles.select} value={deliveryFilter} onChange={e => { setDeliveryFilter(e.target.value); setSelected([]); }}>{['ALL', 'BELUM', 'SENT', 'FAILED', 'LMS_ONLY', 'NO_CONTACT', 'SENDING', 'SIMULATED'].map(v => <option key={v} value={v}>{({ ALL: 'Semua status', BELUM: 'Belum dikirim', SENT: 'Terkirim WA', FAILED: 'Gagal', LMS_ONLY: 'Hanya LMS', NO_CONTACT: 'Tanpa kontak', SIMULATED: 'Simulasi local', SENDING: 'Sedang dikirim' } as Record<string, string>)[v]}</option>)}</select></label></>}<Button variant="ghost" onClick={() => { setSearch(''); setKindFilter('ALL'); setPaidFilter('ALL'); setDeliveryFilter('ALL'); setSelected([]); }}>Reset filter</Button></div>}
        {screen === 'payment' && selected.length > 0 ? <section className={styles.selectionBar} aria-label="Tindakan penerima terpilih"><div className={styles.actions}><span className={styles.muted}>{selected.length} dipilih</span><Button disabled={Boolean(busy) || !selected.length} onClick={() => unpaidSelected.length ? bulk('transfer', undefined, unpaidSelected) : bulk('send', 'SLIP')}>{unpaidSelected.length > 0 ? <CheckCheck data-icon="inline-start" /> : <Send data-icon="inline-start" />}{unpaidSelected.length ? 'Tandai sudah transfer' : 'Kirim slip gaji'}</Button><Button variant="ghost" disabled={Boolean(busy)} onClick={() => setSelected([])}>Batal pilih</Button></div><p className={styles.muted}>{unpaidSelected.length ? 'Tandai setelah transfer bank selesai, lalu kirim slip.' : 'Slip dikirim hanya ke penerima terpilih.'}</p></section> : screen === 'payment' && <p className={styles.muted}>Centang penerima untuk menandai transfer yang sudah selesai, lalu kirim slip gaji.</p>}
        <p className="text-xs text-muted-foreground sm:hidden">Geser tabel untuk melihat nominal, status, dan tindakan.</p>
        <Table className={styles.table}><TableHeader><TableRow>{screen === 'payment' && <TableHead><input className={styles.checkbox} aria-label="Pilih semua hasil filter" type="checkbox" disabled={Boolean(busy)} checked={visible.length > 0 && visible.every(s => selected.includes(s.profile_id))} onChange={e => setSelected(e.target.checked ? visible.map(s => s.profile_id) : [])} /></TableHead>}<TableHead>Penerima</TableHead>{screen === 'review' && <TableHead>Aktivitas</TableHead>}<TableHead>Total periode</TableHead>{screen === 'payment' && <><TableHead>Transfer</TableHead><TableHead>Pengiriman slip</TableHead></>}<TableHead>Tindakan</TableHead></TableRow></TableHeader><TableBody>{visible.map(s => <TableRow key={s.profile_id}>{screen === 'payment' && <TableCell><input className={styles.checkbox} type="checkbox" aria-label={`Pilih ${s.name}`} disabled={Boolean(busy)} checked={selected.includes(s.profile_id)} onChange={e => setSelected(e.target.checked ? [...selected, s.profile_id] : selected.filter(id => id !== s.profile_id))} /></TableCell>}<TableCell><div className={styles.rowname}>{s.name}</div><div className={styles.rowmeta}>{[s.kind === 'COACH' ? 'Coach' : 'Staf', !s.contract_unconfirmed && (s.contract === 'FULLTIME' ? 'Fulltime' : 'Mitra'), s.job_title && s.job_title !== 'Coach' && s.job_title].filter(Boolean).join(' · ')}</div></TableCell>{screen === 'review' && <TableCell className={styles.muted}>{payrollActivitySummary(s)}</TableCell>}<TableCell className={styles.money}>{rupiah(s.total)}</TableCell>{screen === 'payment' && <><TableCell><Badge variant={isPaid(period, s.profile_id) ? 'default' : 'outline'}>{isPaid(period, s.profile_id) ? 'Sudah ditransfer' : 'Belum selesai'}</Badge><div className={styles.rowmeta}>{rupiah(paidAmount(period, s.profile_id))}{paidAmount(period, s.profile_id) > s.total ? ' · Ada kelebihan tercatat' : ''}</div></TableCell><TableCell><Badge variant={delivery(s) === 'FAILED' ? 'destructive' : 'secondary'}>{deliveryLabels[delivery(s)] ?? 'Perlu diperiksa'}</Badge></TableCell></>}<TableCell><div className={styles.actions}><Button size="sm" variant="outline" onClick={() => { setDetail(s.profile_id); setError(''); setMessage(''); }}>Rincian</Button><Button size="sm" variant="ghost" aria-label={`Pratinjau slip ${s.name}`} onClick={() => openPreview(s)}><FileText data-icon="inline-start" />Pratinjau</Button></div></TableCell></TableRow>)}</TableBody></Table>{visible.length === 0 && <div className={styles.empty}>Belum ada penerima yang cocok. Perbarui rekap atau ubah filter.</div>}
      </section>}
      {focused && <PayrollDetailDialog key={`${period.id}:${focused.profile_id}`} period={period} slip={focused} people={data.people} meetingCandidates={data.meetingCandidates} busy={Boolean(busy)} error={error} message={message} previewOpen={Boolean(preview)} close={() => setDetail(null)} clearFeedback={() => { setError(''); setMessage(''); }} run={run} preview={openPreview} resend={(kind, profileId) => bulk('send', kind, [profileId], true)} />}
      <PayrollPreviewDialog period={period} preview={preview} close={() => setPreview(null)} />
      {screen === 'history' && <section className={styles.panel}><div className={styles.detailheader}><h2>Riwayat perubahan periode</h2>{period.status === 'FINAL' && <Button variant="outline" disabled={Boolean(busy)} onClick={() => { const reason = window.prompt('Alasan membuka revisi (minimal 5 karakter). Riwayat transfer dan versi lama tetap tersimpan.'); if (reason) run('reopen', { reason }); }}>Buka revisi admin</Button>}</div><div className={styles.audit}><ol>{data.audit.map((a: { id: number; created_at: string; action: string; reason: string }) => <li key={a.id}>{dateWib(a.created_at)} WIB · {a.action} {a.reason && `· ${a.reason}`}</li>)}</ol></div>{Object.entries(period.deliveries).filter(([, d]) => d.status === 'SENDING' || d.error).map(([key, d]) => <div key={key} className={styles.toolbar}><span className={styles.muted}>{data.people.find(p => p.id === d.profile_id)?.name} · {d.kind} · {d.status} {d.error}</span>{d.status === 'SENDING' && <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => { const reason = window.prompt('Periksa WA terlebih dahulu. Alasan pemulihan status pengiriman:'); if (reason) run('recoverDelivery', { key, reason }); }}>Pulihkan setelah 10 menit</Button>}</div>)}</section>}
        </>
        </TabsContent></Tabs>
      </>}
    </>}
    {tab === 'people' && <><PayrollPeople people={data.people} terms={data.terms} coaches={data.coaches} date={today()} busy={Boolean(busy)} edit={editPerson} add={addPerson} /><Dialog open={personOpen} onOpenChange={setPersonOpen}><DialogContent className={styles.modal}><DialogHeader className={styles.modalHeader}><DialogTitle>{editing ? 'Profil & tunjangan' : 'Tambah penerima gaji'}</DialogTitle><DialogDescription>Atur gaji rutin dan kontak penerima. Tambahan khusus bulan tertentu diatur lewat Rincian periode.</DialogDescription></DialogHeader><div className={styles.modalBody}>{error && <p role="alert" className={styles.error}>{error}</p>}<form key={editing?.id ?? `new-${personKind}-${newCoachId}`} onSubmit={e => { const workingDays = new FormData(e.currentTarget).getAll('workingDays').map(Number); const f = formData(e); if (personKind === 'COACH' && personContract === 'FULLTIME' && !workingDays.length) { setError('Pilih minimal satu hari kerja coach.'); return; } const coach = data.coaches.find(c => c.id === f.userId); run('profile', { id: editing?.id, kind: personKind, userId: personKind === 'COACH' ? (editing?.user_id ?? f.userId) : null, name: personKind === 'COACH' ? coach?.full_name ?? editing?.name ?? '' : f.name, jobTitle: f.jobTitle, staffPhone: personKind === 'STAFF' ? String(f.staffPhone || '') || null : null, active: f.active === 'on', contract: f.contract, workingDays: workingDays.length ? workingDays : undefined, baseSalary: Number(f.baseSalary || 0), positionAllowance: Number(f.positionAllowance || 0), otherAllowances: JSON.parse(String(f.otherAllowances || '[]')), effectiveFrom: f.effectiveFrom }); }}><fieldset disabled={Boolean(busy)} className={styles.form}><legend>{editing ? `Profil ${editing.name}` : 'Tambah coach / staf'}</legend><label className={styles.field}>Kategori<select className={styles.select} value={personKind} disabled={Boolean(editing)} onChange={e => setPersonKind(e.target.value)}><option value="COACH">Coach</option><option value="STAFF">Staf non-coach</option></select></label>{personKind === 'COACH' ? <label className={styles.field}>Akun coach<select className={styles.select} name="userId" defaultValue={editing?.user_id ?? newCoachId} disabled={Boolean(editing)} required><option value="">Pilih coach</option>{data.coaches.filter(c => editing?.user_id === c.id || !data.people.some(p => p.user_id === c.id)).map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label> : <><label className={styles.field}>Nama staf<Input name="name" defaultValue={editing?.name} required /></label><label className={styles.field}>Nomor WA pribadi<Input name="staffPhone" defaultValue={editing?.staff_phone ?? ''} placeholder="08… / 628…" /></label></>}
      <label className={styles.field}>Jabatan<Input name="jobTitle" defaultValue={editing?.job_title ?? (personKind === 'COACH' ? 'Coach' : '')} /></label><label className={styles.field}>Status kontrak<select name="contract" className={styles.select} value={personContract} onChange={e => setPersonContract(e.target.value)} required><option value="" disabled>Pilih status kontrak</option><option value="MITRA">Mitra</option><option value="FULLTIME">Fulltime</option></select></label>{personKind === 'COACH' && personContract === 'FULLTIME' && <fieldset className={styles.wide}>
        <legend>Hari kerja Fulltime</legend>
        <div className={styles.toolbar}>{['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map((label, index) => {
          const day = (index + 1) % 7;
          return <label key={day} className={styles.checklabel}><input type="checkbox" name="workingDays" value={day} defaultChecked={(personTerm?.working_days ?? DEFAULT_COACH_WORKING_DAYS).includes(day)} />{label}</label>;
        })}</div>
        <p className={styles.muted}>Kelas di luar hari kerja otomatis pakai tarif Mitra. Koreksi mode per sesi tetap berlaku.</p>
      </fieldset>}{personContract === 'FULLTIME' ? <label className={styles.field}>Gaji pokok / bulan<Input name="baseSalary" type="number" min="1" step="1" defaultValue={personTerm?.base_salary || ''} placeholder="Isi gaji pokok fulltime" required /></label> : <><input type="hidden" name="baseSalary" value="0" />{personContract === 'MITRA' && <p className={styles.muted}>Mitra mendapat fee sesuai aktivitas. Tunjangan rutin tetap bisa ditambahkan di bawah.</p>}</>}<label className={styles.field}>Berlaku mulai<Input name="effectiveFrom" type="date" defaultValue={personTerm && personTerm.effective_from > today() ? personTerm.effective_from : today()} required /></label><PayrollAllowanceFields term={personTerm} /><label className={styles.checklabel}><input type="checkbox" className={styles.checkbox} name="active" defaultChecked={editing?.active ?? (newCoachId ? data.coaches.find(c => c.id === newCoachId)?.is_active ?? true : true)} />Penerima aktif</label><Button type="submit">Simpan profil &amp; gaji</Button><p className={`${styles.muted} ${styles.wide}`}>Fulltime tetap mendapat bonus goal. Trial fulltime tidak mendapat tambahan fee trial. Perubahan kontrak memakai tanggal berlaku; versi final lama tetap tersimpan.</p></fieldset></form></div></DialogContent></Dialog></>}
    {tab === 'attendance' && <CoachAttendance embedded initialPeriod={`${year}-${String(month).padStart(2, '0')}`} onChanged={() => { void load().catch(e => setError(e.message)); }} />}

    {tab === 'settings' && <Tabs value={settingsSection} onValueChange={setSettingsSection}><TabsList className={styles.workspaceTabs} aria-label="Pengaturan penggajian"><TabsTrigger value="rates">Tarif aktivitas</TabsTrigger><TabsTrigger value="automation">Otomatisasi</TabsTrigger></TabsList>
      <TabsContent value="automation"><PayrollAutomation settings={data.settings} busy={Boolean(busy)} save={extra=>run('settings',extra)} /></TabsContent>
      <TabsContent value="rates"><PayrollRates cards={data.cards} date={today()} busy={Boolean(busy)} saveError={error} save={extra => run('rates', extra, 'Tarif tersimpan sesuai tanggal berlaku.')} /></TabsContent>
    </Tabs>}
    </>}
  </main>;
}
