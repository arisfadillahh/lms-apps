'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { currentPeriod } from '@/lib/payroll/model';
import type { AttendancePeriodView } from '@/lib/payroll/attendanceView';
import type { attendanceBootstrap } from '@/lib/services/payrollAttendance';
import { dateWib, payrollCategory } from '@/lib/payroll/presentation';
import PayrollCorrections from '../payroll/PayrollCorrections';
import PayrollRequests from '../payroll/PayrollRequests';
import PayrollCorrection from '../payroll/PayrollCorrection';
import styles from '../payroll/PayrollAdmin.module.css';

type Data = Awaited<ReturnType<typeof attendanceBootstrap>>;
type Activity = AttendancePeriodView['activities'][number];
export default function CoachAttendance({ initialPeriod }: { initialPeriod?: string }) {
  const [periodId, setPeriodId] = useState(/^20\d{2}-(0[1-9]|1[0-2])$/.test(initialPeriod ?? '') ? initialPeriod! : currentPeriod().id);
  const [data, setData] = useState<Data | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [search, setSearch] = useState(''), [tab, setTab] = useState('corrections'), [editing, setEditing] = useState<Activity | 'new' | null>(null);
  const [coachFilter, setCoachFilter] = useState('ALL');
  async function fetchData(id: string): Promise<Data> {
    const r = await fetch(`/api/admin/coach-attendance?period=${id}`, { cache: 'no-store' }), d = await r.json();
    if (!r.ok) throw new Error(d.error); return d;
  }
  useEffect(() => { let active = true; fetchData(periodId).then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [periodId]);
  const p = data?.selected?.id === periodId ? data.selected : null;
  async function run(action: string, extra: Record<string, unknown> = {}, success = 'Perubahan disimpan.') {
    setBusy(true); setError(''); setMessage('');
    let saved = false;
    try {
      const r = await fetch('/api/admin/coach-attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, periodId, revision: p?.revision, ...extra }) }), d = await r.json();
      if (!r.ok) throw new Error(d.error);
      saved = true;
      let latest = await fetchData(periodId);
      if (['override', 'activity', 'removeActivity', 'reviewActivity'].includes(action) && latest.selected?.status === 'DRAFT') {
        const refreshed = await fetch('/api/admin/coach-attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'calculate', periodId, revision: latest.selected.revision }) });
        if (!refreshed.ok) throw new Error('Gunakan Perbarui absensi untuk memuat hasil terbaru.');
        latest = await fetchData(periodId); success = 'Perubahan disimpan dan daftar aktivitas diperbarui.';
      }
      setData(latest); setMessage(success); return true;
    } catch (e) { setError(saved ? 'Perubahan sudah tersimpan; jangan input ulang. Gunakan Perbarui absensi untuk memuat hasil terbaru.' : e instanceof Error ? e.message : 'Perubahan gagal.'); setData(await fetchData(periodId).catch(() => data)); return saved; }
    finally { setBusy(false); }
  }
  const rows = (p?.activities ?? []).filter(a => (coachFilter === 'ALL' || a.profile_id === coachFilter) && (!search || `${a.coach_name} ${a.label}`.toLowerCase().includes(search.toLowerCase())));
  return <main className={styles.root}>
    <header className={styles.header}><div><h1 className={styles.title}>Absensi &amp; koreksi coach</h1><p className={styles.muted}>Admin dan coach lead memeriksa aktivitas serta menangani pengajuan koreksi.</p></div></header>
    {!editing && error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
    <section className={`${styles.panel} ${styles.periodBar}`}><label className={styles.field}>Periode<Input aria-label="Periode absensi" type="month" min="2020-01" max="2099-12" value={periodId} onChange={e => { if (e.target.value) { setPeriodId(e.target.value); setEditing(null); setError(''); setMessage(''); } }} /></label>{p && <Badge variant="secondary">{p.status === 'FINAL' ? 'Final' : 'Berjalan'}</Badge>}<div className={styles.actions}>{p?.status === 'DRAFT' && <Button variant="outline" disabled={busy} onClick={() => { void run('calculate', {}, 'Absensi diperbarui dari sumber terbaru.'); }}>Perbarui absensi</Button>}{data && !p && <Button disabled={busy} onClick={() => { void run('create', { year: Number(periodId.slice(0, 4)), month: Number(periodId.slice(5)) }); }}>Buat periode</Button>}</div></section>
    {!data ? <p>Memuat absensi…</p> : <>
      {p?.status === 'FINAL' && <p className={styles.notice}>Periode sudah final. Minta admin membuka revisi periode sebelum memperbaiki aktivitas; riwayat lama tetap tersimpan.</p>}
      {!!p?.warnings.length && <div className={styles.notice}>{p.warnings.map(w => <p key={w}>{w}</p>)}</div>}
      <Tabs value={tab} onValueChange={setTab}><TabsList aria-label="Area absensi" className="grid h-auto w-full grid-cols-3 sm:w-fit"><TabsTrigger className="h-full whitespace-normal text-xs sm:text-sm" value="corrections">Pengajuan koreksi</TabsTrigger><TabsTrigger className="h-full whitespace-normal text-xs sm:text-sm" value="activities">Aktivitas coach</TabsTrigger><TabsTrigger className="h-full whitespace-normal text-xs sm:text-sm" value="requests">Event &amp; kegiatan</TabsTrigger></TabsList>
        <TabsContent value="corrections"><PayrollCorrections period={p ?? undefined} admins={data.admins} coaches={data.coaches} busy={busy} run={run} inspect={userId => { setCoachFilter(data.people.find(c => c.user_id === userId)?.id ?? 'ALL'); setSearch(''); setTab('activities'); }} /></TabsContent>
        <TabsContent value="requests"><PayrollRequests attendanceOnly requests={data.requests} coaches={data.coaches} period={periodId} busy={busy} error={error} review={extra => run('reviewActivity', extra)} /></TabsContent>
        <TabsContent value="activities"><section className={styles.panel}><div className={styles.toolbar}><label className={styles.field}>Coach<select aria-label="Filter coach" className={styles.select} value={coachFilter} onChange={e => setCoachFilter(e.target.value)}><option value="ALL">Semua coach</option>{data.people.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><Input aria-label="Cari coach atau aktivitas" placeholder="Cari kegiatan" value={search} onChange={e => setSearch(e.target.value)} />{p?.status === 'DRAFT' && <Button variant="outline" disabled={busy} onClick={() => { setError(''); setEditing('new'); }}>Tambah aktivitas terlewat</Button>}</div>
          <Table className={styles.table}><TableHeader><TableRow><TableHead>Coach / kegiatan</TableHead><TableHead>Tanggal</TableHead><TableHead>Jenis / peserta</TableHead><TableHead>Status</TableHead><TableHead>Tindakan</TableHead></TableRow></TableHeader><TableBody>{rows.map(a => <TableRow key={a.key}><TableCell><strong>{a.coach_name}</strong><div>{a.label}</div></TableCell><TableCell>{a.date ? `${dateWib(a.date)} WIB` : 'Rekap bulanan'}</TableCell><TableCell>{payrollCategory(a.kind)}{a.quantity > 1 && <div>{a.quantity} sesi</div>}{a.students !== undefined && <div>{a.students} anak</div>}</TableCell><TableCell>{a.status}</TableCell><TableCell>{p?.status === 'DRAFT' && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setError(''); setEditing(a); }}>Koreksi</Button>}</TableCell></TableRow>)}</TableBody></Table>{!rows.length && <p className={styles.muted}>Belum ada aktivitas pada filter ini. Gunakan Perbarui absensi untuk membaca sumber terbaru.</p>}
        </section></TabsContent>
      </Tabs>
      <Dialog open={editing !== null} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent className={`${styles.modal} ${styles.formModal}`}><DialogHeader className={styles.modalHeader}><DialogTitle>{editing === 'new' ? 'Tambah aktivitas terlewat' : 'Koreksi aktivitas'}</DialogTitle><DialogDescription>{editing && editing !== 'new' ? `${editing.coach_name} · ${editing.label}` : 'Catat hanya kegiatan yang belum tercatat. Untuk kegiatan yang sudah ada, koreksi barisnya agar tidak ganda.'}</DialogDescription></DialogHeader><div className={styles.modalBody}>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {editing === 'new' && <form onSubmit={async e => {
          e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget));
          const extra = { profileId: f.profileId, date: f.date, label: f.label, kind: f.kind, delivery: f.delivery, students: Number(f.students), mode: f.mode, reason: f.reason };
          if (await run('activity', extra, 'Aktivitas disimpan dan daftar diperbarui.')) setEditing(null);
        }}><fieldset className={styles.form} disabled={busy}>
          <label className={styles.field}>Coach penerima<select name="profileId" className={styles.select} defaultValue="" required><option value="" disabled>Pilih coach</option>{data.people.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className={styles.field}>Mode penugasan<select name="mode" className={styles.select} defaultValue="MITRA"><option value="MITRA">Mitra</option><option value="FULLTIME">Fulltime</option></select></label>
          <label className={styles.field}>Tanggal<Input name="date" type="date" required /></label><label className={styles.field}>Jenis aktivitas<select name="kind" className={styles.select}>{['WEEKLY', 'EKSKUL', 'TRIAL', 'EVENT', 'TRAINING_ONLINE', 'TRAINING_OFFLINE', 'OBSERVATION_ONLINE', 'OBSERVATION_OFFLINE'].map(k => <option key={k} value={k}>{payrollCategory(k)}</option>)}</select></label><label className={styles.field}>Pelaksanaan<select name="delivery" className={styles.select}><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option></select></label><label className={styles.field}>Jumlah anak<Input name="students" type="number" min={1} max={500} defaultValue={1} required /></label><label className={`${styles.field} ${styles.wide}`}>Nama kegiatan<Input name="label" maxLength={160} required /></label>
          <label className={`${styles.field} ${styles.wide}`}>Alasan penambahan<Input name="reason" minLength={5} maxLength={1000} required /></label><Button type="submit">Tambah aktivitas</Button>
        </fieldset></form>}
        {editing && editing !== 'new' && <>
          <PayrollCorrection key={editing.key} attendanceOnly line={editing} people={data.people} profileId={editing.profile_id} candidates={data.meetingCandidates} usedMeetingKeys={Object.entries(p?.overrides ?? {}).filter(([key]) => key !== editing.key).flatMap(([, entry]) => entry.meeting_keys ?? [])} override={p?.overrides[editing.key]} busy={busy} close={() => setEditing(null)} save={extra => { void run('override', extra, 'Koreksi disimpan dan daftar diperbarui.').then(ok => { if (ok) setEditing(null); }); }} />
          {editing.key.startsWith('manual-activity:') && <Button variant="ghost" type="button" disabled={busy} onClick={() => { const reason = window.prompt('Alasan menghapus aktivitas manual:'); if (reason) void run('removeActivity', { id: editing.key.slice('manual-activity:'.length), reason }, 'Aktivitas dihapus.').then(ok => { if (ok) setEditing(null); }); }}>Hapus aktivitas manual</Button>}
        </>}
      </div></DialogContent></Dialog>
    </>}
  </main>;
}
