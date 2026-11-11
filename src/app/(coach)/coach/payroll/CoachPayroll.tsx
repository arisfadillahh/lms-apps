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
  { id: 'rekap', label: 'Rekap absen', icon: ListChecks },
  { id: 'aktivitas', label: 'Absen event', icon: CalendarDays },
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
export default function CoachPayroll({ initialPeriod }: { initialPeriod?: string }) {
  const [data, setData] = useState<{ profile: { name: string } | null; periods: CoachPeriodView[] } | null>(null);
  const [periodId, setPeriodId] = useState(initialPeriod ?? ''), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [tab, setTab] = useState('rekap');
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  async function load() {
    const r = await fetch('/api/coach/payroll', { cache: 'no-store' }), d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d); setPeriodId(id => d.periods.some((period: CoachPeriodView) => period.id === id) ? id : d.periods[0]?.id || '');
  }
  useEffect(() => { let active = true; fetch('/api/coach/payroll', { cache: 'no-store' }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); if (active) { setData(d); setPeriodId(id => d.periods.some((period: CoachPeriodView) => period.id === id) ? id : d.periods[0]?.id || ''); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  const p = data?.periods.find(p => p.id === periodId);
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
    <main className={`${styles.root} ${pageStyles.page}`}>
      <header className={pageStyles.header}>
        <div>
          <h1 className={styles.title}>Absensi &amp; Slip Gaji</h1>
          <p className={styles.muted}>Lihat rekap, absen event atau training, dan cek slip gaji.</p>
        </div>
        {tab !== 'aktivitas' && !!data?.periods.length && (
          <label className={`${styles.field} ${pageStyles.period}`}>
            Periode
            <select aria-label="Periode" className={styles.select} value={periodId} disabled={busy} onChange={e => {
              setPeriodId(e.target.value);
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
          {p && <section className={styles.panel}>
            <div className={pageStyles.sectionHeader}>
              <div><h2>Rekap absensi</h2><p className={styles.muted}>{p.calculated_at ? `Diperbarui ${dateWib(p.calculated_at)} WIB` : 'Menunggu pembaruan'}</p></div>
              {canCorrect && <Button variant="outline" size="sm" onClick={() => setTab('koreksi')}>Ajukan koreksi</Button>}
            </div>
            {p.activities.length > 0 ? <ul className={pageStyles.activityList}>
              {p.activities.map(activity => <li key={activity.key}>
                <div>
                  <strong>{activity.label}</strong>
                  <p className={styles.muted}>{activity.date ? `${dateWib(activity.date)} WIB` : 'Rekap bulanan'}</p>
                </div>
                <p className={pageStyles.activityKind}>{activityLabels[activity.kind] ?? activity.kind}
                  {activity.quantity > 1 && <span> · {activity.quantity} sesi</span>}
                  {activity.students !== undefined && ['WEEKLY', 'EKSKUL', 'TRIAL'].includes(activity.kind) && <span> · {activity.students} anak</span>}
                </p>
                <Badge variant="secondary" className={pageStyles.status}>{activity.status}</Badge>
              </li>)}
            </ul> : <p className={styles.muted}>Belum ada aktivitas tercatat di periode ini.</p>}
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
    </main>
  );
}
