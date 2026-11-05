'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { activityRateRows, classRateRows, payrollRateView } from '@/lib/payroll/rateView';
import type { PayrollRates as Rates, RateCard } from '@/lib/payroll/model';
import { rupiah } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

const dateLabel = (date: string) => new Date(`${date}T12:00:00+07:00`).toLocaleDateString('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' });
export default function PayrollRates({ cards, date, busy, save, saveError }: {
  cards: RateCard[]; date: string; busy: boolean; saveError: string; save: (extra: Record<string, unknown>) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState(''), [open, setOpen] = useState(false);
  const view = payrollRateView(cards, date, selected);
  const [draft, setDraft] = useState<Rates>(view.rates), [from, setFrom] = useState(date), [error, setError] = useState('');
  const replacing = cards.some(c => c.effective_from === from);
  const openEditor = () => { setDraft(structuredClone(view.rates)); setFrom(date); setError(''); setOpen(true); };
  async function submit(e: FormEvent) {
    e.preventDefault(); setError('');
    if (await save({ effectiveFrom: from, rates: draft })) { setSelected(from); setOpen(false); }
    else setError('Tarif belum tersimpan. Periksa pesan kesalahan di halaman atau coba lagi.');
  }
  return <section className={styles.panel} aria-label="Tarif aktivitas">
    <div className={styles.peopleHeader}><div><h2>Tarif aktivitas</h2><p className={styles.muted}>{view.status === 'DEFAULT' ? 'Tarif awal · belum disimpan' : view.status === 'FUTURE' ? 'Terjadwal' : view.status === 'PAST' ? 'Riwayat tarif' : 'Berlaku sekarang'}{view.date ? ` · mulai ${dateLabel(view.date)}` : ''}</p></div><div className={styles.actions}>
      {cards.length > 0 && <select aria-label="Lihat riwayat tarif" className={styles.select} style={{ width: 'auto', maxWidth: '100%' }} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Tarif yang berlaku</option>{[...cards].sort((a,b) => b.effective_from.localeCompare(a.effective_from)).map(c => <option key={c.effective_from} value={c.effective_from}>{dateLabel(c.effective_from)}{c.effective_from > date ? ' · terjadwal' : ''}</option>)}</select>}
      <Button disabled={busy} onClick={openEditor}>{view.status === 'PAST' || view.status === 'FUTURE' ? 'Salin jadi tarif baru' : 'Ubah tarif'}</Button>
    </div></div>
    {view.status === 'DEFAULT' && <p className={styles.notice}>Belum ada tarif yang berlaku hari ini. Simpan tarif dengan tanggal berlaku sebelum menghitung rekap.</p>}
    <div className={styles.rateSections}><section><h3 className={styles.rateHeading}>Kelas · per sesi</h3><p className={styles.muted}>Sesuai jumlah anak aktif pada tanggal sesi.</p><Table className={styles.rateTable}><TableHeader><TableRow><TableHead>Kelas</TableHead><TableHead>1 anak</TableHead><TableHead>2 anak</TableHead><TableHead>3+ anak</TableHead></TableRow></TableHeader><TableBody>{classRateRows.map(row => <TableRow key={row.key}><TableCell><strong>{row.label}</strong><div className={styles.rowmeta}>{row.delivery}</div></TableCell>{view.rates[row.key].map((amount,i) => <TableCell className={styles.money} key={i}>{rupiah(amount)}</TableCell>)}</TableRow>)}</TableBody></Table></section>
    <section><h3 className={styles.rateHeading}>Kegiatan &amp; bonus</h3><Table className={styles.rateTable}><TableHeader><TableRow><TableHead>Aktivitas</TableHead><TableHead>Tarif</TableHead></TableRow></TableHeader><TableBody>{activityRateRows.map(row => <TableRow key={row.key}><TableCell>{row.label}<div className={styles.rowmeta}>{row.unit}</div></TableCell><TableCell className={styles.money}>{rupiah(view.rates[row.key])}</TableCell></TableRow>)}</TableBody></Table></section></div>
    <p className={styles.peopleHint}>Trial dihitung per sesi, bonus goal per anak. Coach fulltime mendapat bonus goal tanpa fee trial. Transport diinput manual per periode.</p>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className={`${styles.modal} ${styles.ratesModal}`}><DialogHeader className={styles.modalHeader}><DialogTitle>Ubah tarif aktivitas</DialogTitle><DialogDescription>Tarif dipakai sesuai tanggal aktivitas. Slip yang sudah final tetap tersimpan.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className={styles.rateForm}><div className={styles.modalBody}><fieldset disabled={busy} className={styles.rateFields}>
        <label className={styles.field}>Berlaku mulai<Input type="date" required value={from} onChange={e => setFrom(e.target.value)} /></label>
        {replacing && <p className={styles.notice}>Tarif pada {dateLabel(from)} sudah ada dan akan diganti saat disimpan.</p>}
        <h3 className={styles.rateHeading}>Kelas · rupiah per sesi</h3><p className={styles.muted}>Geser tabel jika semua kolom belum terlihat.</p>
        <Table className={`${styles.rateTable} ${styles.rateEditTable}`}><TableHeader><TableRow><TableHead>Kelas</TableHead><TableHead>1 anak</TableHead><TableHead>2 anak</TableHead><TableHead>3+ anak</TableHead></TableRow></TableHeader><TableBody>{classRateRows.map(row => <TableRow key={row.key}><TableCell>{row.label}<div className={styles.rowmeta}>{row.delivery}</div></TableCell>{draft[row.key].map((amount,i) => <TableCell key={i}><Input aria-label={`${row.label} ${row.delivery.toLowerCase()} ${i === 2 ? '3+ anak' : `${i+1} anak`}`} type="number" min="0" step="1" required value={amount} onChange={e => setDraft(prev => ({ ...prev, [row.key]: prev[row.key].map((v,j) => i === j ? Number(e.target.value) : v) }))} /></TableCell>)}</TableRow>)}</TableBody></Table>
        <h3 className={styles.rateHeading}>Kegiatan &amp; bonus · rupiah</h3><div className={styles.activityRateFields}>{activityRateRows.map(row => <label className={styles.field} key={row.key}>{row.label} · {row.unit}<Input type="number" min="0" step="1" required value={draft[row.key]} onChange={e => setDraft(prev => ({ ...prev, [row.key]: Number(e.target.value) }))} /></label>)}</div>
        {error && <p role="alert" className={styles.error}>{saveError || error}</p>}
      </fieldset></div><div className={styles.modalFooter}><Button variant="outline" type="button" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={busy || !from}>{busy ? 'Menyimpan…' : 'Simpan tarif'}</Button></div></form>
    </DialogContent></Dialog>
  </section>;
}
