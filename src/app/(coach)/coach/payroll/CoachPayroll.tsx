'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ClipboardPenLine, FileText, ListChecks } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requestLabels } from '@/lib/payroll/activityRequests';
import { dateWib } from '@/lib/payroll/presentation';
import type { CoachPeriodView } from '@/lib/payroll/coachView';
import styles from '../../../(admin)/admin/payroll/PayrollAdmin.module.css';
import CoachActivityRequests from './CoachActivityRequests';
import pageStyles from './CoachPayroll.module.css';

const tabs = [
  { id: 'rekap', label: 'Rekap', icon: ListChecks },
  { id: 'aktivitas', label: 'Kegiatan', icon: CalendarDays },
  { id: 'koreksi', label: 'Koreksi', icon: ClipboardPenLine },
  { id: 'slip', label: 'Slip gaji', icon: FileText },
];

const activityLabels: Record<string, string> = {
  CLASS_SUMMARY: 'Kelas', WEEKLY: 'Kelas', EKSKUL: 'Ekskul', TRIAL: 'Trial', ...requestLabels,
};

function periodLabel(id: string) {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${id}-01T00:00:00Z`));
}

const statuses = { WAITING: 'Menunggu', IN_PROGRESS: 'Diproses', DONE: 'Selesai', REJECTED: 'Ditolak' };
type RecapFilter = 'all' | 'review';

function needsAttendanceReview(activity: CoachPeriodView['activities'][number]) {
  return activity.status !== 'Dibatalkan' && (activity.attendance_status === 'PENDING' || activity.attendance_status === 'PARTIAL');
}

export default function CoachPayroll({ initialPeriod }: { initialPeriod?: string }) {
  const [data, setData] = useState<{ profile: { name: string } | null; periods: CoachPeriodView[] } | null>(null);
  const [periodId, setPeriodId] = useState(initialPeriod ?? ''), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [tab, setTab] = useState('rekap');
  const [recapFilter, setRecapFilter] = useState<RecapFilter>('all');
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  async function load() {
    const r = await fetch('/api/coach/payroll', { cache: 'no-store' }), d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d); setPeriodId(id => d.periods.some((period: CoachPeriodView) => period.id === id) ? id : d.periods[0]?.id || '');
  }
  useEffect(() => { let active = true; fetch('/api/coach/payroll', { cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); if (active) { setData(d); setPeriodId(id => d.periods.some((period: CoachPeriodView) => period.id === id) ? id : d.periods[0]?.id || ''); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  const p = data?.periods.find(p => p.id === periodId);
  const activities = p?.activities ?? [];
  const reviewActivities = activities.filter(needsAttendanceReview);
  const visibleActivities = recapFilter === 'review' ? reviewActivities : activities;
  async function correction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    const form = e.currentTarget, id = requestId ?? crypto.randomUUID(); setRequestId(id);
    try {
      const r = await fetch('/api/coach/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, periodId, message: new FormData(form).get('message') }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setMessage('Pengajuan tersimpan. Pantau tanggapan admin di bawah.'); form.reset(); setRequestId(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengirim koreksi.'); } finally { setBusy(false); }
  }
  const canCorrect = p?.status === 'DRAFT' && clock < Date.parse(p.correction_deadline);
  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <div>
          <h1 className={styles.title}>Absensi &amp; Slip Gaji</h1>
        </div>
        {tab !== 'aktivitas' && !!data?.periods.length && (
          <label className={`${styles.field} ${pageStyles.period}`}>
            Periode
            <select aria-label="Periode" className={styles.select} value={periodId} disabled={busy} onChange={e => {
              setPeriodId(e.target.value);
              setRecapFilter('all');
              setRequestId(null);
              setMessage('');
              setError('');
            }}>
              {data.periods.map(period => <option key={period.id} value={period.id}>{periodLabel(period.id)}</option>)}
            </select>
          </label>
        )}
      </header>

      <Tabs value={tab} onValueChange={setTab} className={pageStyles.tabs}>
        <TabsList className={pageStyles.tabList} aria-label="Absensi dan slip gaji">
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger className={pageStyles.tab} key={id} value={id}><Icon aria-hidden="true" />{label}</TabsTrigger>
          ))}
        </TabsList>

        {tab !== 'aktivitas' && error && <p role="alert" className={styles.error}>{error}</p>}
        {tab !== 'aktivitas' && !p && <section className={styles.panel}>
          {!data && !error ? <p role="status">Memuat rekap…</p> : data ? <><h2>Belum ada rekap absensi</h2><p className={styles.muted}>Rekap akan muncul setelah admin menyiapkan periode.</p></> : (
            <Button variant="outline" onClick={() => { setError(''); void load().catch(e => setError(e.message)); }}>Coba lagi</Button>
          )}
        </section>}

        <TabsContent value="rekap">
          {p && <section className={`${styles.panel} ${pageStyles.recap}`} aria-labelledby="coach-attendance-recap">
            <div className={pageStyles.sectionHeader}>
              <div><h2 id="coach-attendance-recap">Rekap absensi</h2><p className={styles.muted}>{p.calculated_at ? `Diperbarui ${dateWib(p.calculated_at)} WIB` : 'Menunggu pembaruan'}</p></div>
              {canCorrect && <Button variant="outline" size="sm" onClick={() => setTab('koreksi')}>Ajukan koreksi</Button>}
            </div>
            {activities.length > 0 && <div className={pageStyles.recapFilters} role="group" aria-label="Filter rekap absensi">
              <Button variant={recapFilter === 'all' ? 'secondary' : 'ghost'} size="sm" aria-pressed={recapFilter === 'all'} onClick={() => setRecapFilter('all')}>Semua · {activities.length}</Button>
              <Button variant={recapFilter === 'review' ? 'secondary' : 'ghost'} size="sm" aria-pressed={recapFilter === 'review'} onClick={() => setRecapFilter('review')}>Perlu dicek · {reviewActivities.length}</Button>
            </div>}
            {visibleActivities.length ? <ul className={pageStyles.activityList}>
              {visibleActivities.map(activity => {
                const isClassMeeting = ['WEEKLY', 'EKSKUL', 'TRIAL'].includes(activity.kind);
                const kind = activityLabels[activity.kind] ?? activity.kind;
                const delivery = isClassMeeting && activity.delivery ? ` ${activity.delivery.toLowerCase()}` : '';
                const statusTone = needsAttendanceReview(activity) ? 'review'
                  : ['Tercatat', 'Coach pengganti', 'Mengajar dikonfirmasi admin'].includes(activity.status) ? 'recorded' : 'neutral';
                return <li key={activity.key}>
                  <div className={pageStyles.activityDetail}>
                    <strong>{activity.label}</strong>
                    <p className={pageStyles.activityKind}>{kind}{delivery}
                      {isClassMeeting && activity.students !== undefined && ` · ${activity.students} anak`}
                      {activity.quantity > 1 && ` · ${activity.quantity} sesi`}
                    </p>
                    <p className={pageStyles.activityDate}>{activity.date ? `${dateWib(activity.date)} WIB` : 'Rekap bulanan'}</p>
                  </div>
                  <Badge variant="secondary" className={pageStyles.status} data-tone={statusTone}>{activity.status}</Badge>
                </li>;
              })}
            </ul> : <p className={styles.muted}>{recapFilter === 'review' ? 'Tidak ada absensi siswa yang perlu dicek.' : 'Belum ada aktivitas tercatat di periode ini.'}</p>}
          </section>}
        </TabsContent>

        <TabsContent value="aktivitas" forceMount className={pageStyles.keepPanel}>
          <CoachActivityRequests />
        </TabsContent>

        <TabsContent value="koreksi" forceMount className={pageStyles.keepPanel}>
          {p && <section className={styles.panel}>
            <div><h2>Pengajuan koreksi</h2><p className={styles.muted}>Batas pengajuan {dateWib(p.correction_deadline)} WIB. Aktivitas tanggal 25 tetap masuk rekap sampai akhir hari.</p></div>
            {message && <p role="status">{message}</p>}
            {canCorrect ? <form key={p.id} onSubmit={correction}>
              <fieldset className={styles.form} disabled={busy}>
                <label className={`${styles.field} ${styles.wide}`}>Tanggal, kelas, dan rincian yang perlu diperbaiki
                  <textarea name="message" minLength={10} maxLength={2000} required rows={3} className="rounded-md border p-3" onChange={() => setRequestId(null)} />
                </label>
                <Button className={pageStyles.submit} type="submit">{busy ? 'Mengirim…' : 'Ajukan koreksi'}</Button>
              </fieldset>
            </form> : <p className={styles.muted}>Pengajuan koreksi untuk periode ini sudah ditutup.</p>}
            <h3 className={pageStyles.historyTitle}>Riwayat koreksi</h3>
            {p.corrections.length ? p.corrections.map(r => <div key={r.id} className={styles.notice}>
              <Badge variant="secondary">{statuses[r.status]}</Badge><span className={styles.rowmeta}> {dateWib(r.at)} WIB</span>
              <p>{r.message}</p>{r.response && <p>Tanggapan admin · {r.response}</p>}
            </div>) : <p className={styles.muted}>Belum ada pengajuan koreksi.</p>}
          </section>}
        </TabsContent>

        <TabsContent value="slip">
          {p && <section className={styles.panel}>
            <h2>Slip gaji {periodLabel(p.id)}</h2>
            {p.slipUrl ? <Button className={pageStyles.submit} asChild>
              <a href={p.slipUrl} target="_blank" rel="noreferrer"><FileText aria-hidden="true" />Buka slip gaji final</a>
            </Button> : <p className={styles.muted}>Slip tersedia setelah pembayaran periode ini dicatat.</p>}
          </section>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
