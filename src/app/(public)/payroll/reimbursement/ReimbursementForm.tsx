'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, FileImage, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submissionsOpen, validateReimbursement, type ReimbursementErrors } from './formValidation';
import styles from './reimbursement.module.css';

type Request = { id: string; title: string; amount: number; status: 'PENDING' | 'APPROVED' | 'REJECTED'; submittedAt: string; reviewNote?: string | null };
type Data = { recipientName: string; periodId: string; periodLabel: string; deadline: string; canSubmit: boolean; requests: Request[] };
const statusLabels = { PENDING: 'Menunggu pemeriksaan', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };
const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value));
const endpoint = '/api/payroll/reimbursement';

export default function ReimbursementForm({ token }: { token: string | null }) {
  const [data, setData] = useState<Data | null>(null), [loading, setLoading] = useState(token === null || Boolean(token)), [loadError, setLoadError] = useState(token === null || token ? '' : 'Tautan pengajuan belum lengkap. Buka tautan pribadi yang dikirim Clevio melalui WhatsApp.');
  const [title, setTitle] = useState(''), [amount, setAmount] = useState(''), [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState(''), [errors, setErrors] = useState<ReimbursementErrors>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [now, setNow] = useState(Date.now);
  const form = useRef<HTMLFormElement>(null), fileInput = useRef<HTMLInputElement>(null), result = useRef<HTMLParagraphElement>(null), submissionId = useRef('');
  const previewUrl = useRef('');
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    fetch(endpoint, { headers: { 'x-payroll-reimbursement-token': token }, cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Tautan ini tidak tersedia. Minta tautan yang berlaku kepada admin.');
      setData(body); setLoadError('');
    }).catch(cause => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Gagal memuat pengajuan. Coba buka kembali tautan ini.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  useEffect(() => { if (success) result.current?.focus(); }, [success]);
  const canSubmit = Boolean(data && submissionsOpen(data.canSubmit, data.deadline, now));

  function updatePhoto(file: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : '';
    setPreview(previewUrl.current); setPhoto(file); submissionId.current = '';
  }
  function choosePhoto(file: File | null) {
    const message = validateReimbursement({ title: 'Bukti pengeluaran', amount: '1', photo: file }).photo;
    updatePhoto(message ? null : file); setErrors(previous => ({ ...previous, photo: message })); setSuccess('');
    if (message && fileInput.current) fileInput.current.value = '';
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy || !canSubmit) return;
    const nextErrors = validateReimbursement({ title, amount, photo });
    setErrors(nextErrors); setError(''); setSuccess('');
    const first = Object.keys(nextErrors)[0];
    if (first) { (form.current?.elements.namedItem(first) as HTMLElement | null)?.focus(); return; }
    if (!submissionId.current) submissionId.current = crypto.randomUUID();
    const payload = new FormData();
    payload.set('title', title.trim()); payload.set('amount', String(Number(amount))); payload.set('photo', photo!); payload.set('submissionId', submissionId.current);
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'x-payroll-reimbursement-token': token }, body: payload, cache: 'no-store', referrerPolicy: 'no-referrer' });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 410) setData(previous => previous && { ...previous, canSubmit: false });
        throw new Error(body.error || 'Pengajuan belum terkirim. Coba kirim kembali.');
      }
      setData(previous => previous && { ...previous, requests: [body.request, ...previous.requests.filter(request => request.id !== body.request.id)] });
      setTitle(''); setAmount(''); updatePhoto(null);
      if (fileInput.current) fileInput.current.value = '';
      setSuccess('Pengajuan terkirim. Admin atau finance akan memeriksa bukti pengeluaranmu.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pengajuan belum terkirim. Coba kirim kembali.'); }
    finally { setBusy(false); setNow(Date.now()); }
  }

  return <main className={styles.page}>
    <div className={styles.container}>
      <header className={styles.brand}><Image src="/logo/innovator-camp-logo-dark.png" alt="Clevio Innovator Camp" width={160} height={56} priority /><span>Penggantian pengeluaran</span></header>
      <section className={styles.sheet} aria-labelledby="reimbursement-title">
        <div className={styles.heading}><h1 id="reimbursement-title">Reimbursement</h1><p>{data ? <><strong>{data.recipientName}</strong><span aria-hidden="true"> · </span>{data.periodLabel}</> : 'Pengajuan penggantian pengeluaran'}</p></div>
        {loading ? <div className={styles.skeleton} role="status" aria-label="Memuat formulir"><span /><span /><span /><p>Memuat formulir…</p></div> : loadError ? <div className={styles.unavailable}><h2>Tautan tidak tersedia</h2><p role="alert">{loadError}</p></div> : data && <>
          <p className={canSubmit ? styles.deadline : styles.closed}><strong>{canSubmit ? 'Batas pengajuan' : 'Pengajuan ditutup'}</strong><span>{date(data.deadline)} WIB</span></p>
          {canSubmit ? <form ref={form} onSubmit={submit} noValidate aria-label="Pengajuan reimbursement" className={styles.form}>
            <p className={styles.intro}>Isi satu pengeluaran per pengajuan. Lampirkan nota atau bukti pembayaran yang jelas.</p>
            {success && <p ref={result} tabIndex={-1} role="status" className={styles.success}><CheckCircle2 aria-hidden="true" />{success}</p>}
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <fieldset disabled={busy}>
              <label className={styles.field} htmlFor="reimbursement-title-input">Nama pengeluaran<Input id="reimbursement-title-input" name="title" placeholder="Contoh: Beli alat untuk kelas robotik" autoComplete="off" maxLength={120} value={title} onChange={event => { setTitle(event.target.value); submissionId.current = ''; setErrors(previous => ({ ...previous, title: undefined })); }} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'title-error' : undefined} required />{errors.title && <span id="title-error" role="alert" className={styles.fieldError}>{errors.title}</span>}</label>
              <label className={styles.field} htmlFor="reimbursement-amount">Nominal (Rp)<Input id="reimbursement-amount" name="amount" inputMode="numeric" pattern="[0-9]*" maxLength={10} placeholder="Contoh: 75000" value={amount} onChange={event => { setAmount(event.target.value); submissionId.current = ''; setErrors(previous => ({ ...previous, amount: undefined })); }} aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'amount-error' : 'amount-help'} required />{errors.amount ? <span id="amount-error" role="alert" className={styles.fieldError}>{errors.amount}</span> : <span id="amount-help" className={styles.hint}>{/^\d+$/.test(amount) && Number(amount) > 0 ? money(Number(amount)) : 'Tulis angka tanpa titik atau koma.'}</span>}</label>
              <div className={styles.field}><label htmlFor="reimbursement-photo">Foto bukti</label><div className={styles.upload}><Upload aria-hidden="true" /><div><Input ref={fileInput} id="reimbursement-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => choosePhoto(event.target.files?.[0] ?? null)} aria-invalid={Boolean(errors.photo)} aria-describedby={errors.photo ? 'photo-help photo-error' : 'photo-help'} required /><span id="photo-help" className={styles.hint}>JPG, PNG, atau WebP · maksimal 5 MB</span></div></div>{errors.photo && <span id="photo-error" role="alert" className={styles.fieldError}>{errors.photo}</span>}{preview && <figure className={styles.preview}><Image src={preview} alt="Pratinjau bukti pengeluaran yang akan dikirim" width={600} height={450} unoptimized /><figcaption><FileImage aria-hidden="true" /><span>{photo?.name}</span><button type="button" aria-label="Hapus foto bukti" onClick={() => { updatePhoto(null); if (fileInput.current) fileInput.current.value = ''; }}><X aria-hidden="true" /></button></figcaption></figure>}</div>
              <Button type="submit" className={styles.submit} disabled={busy || !canSubmit}>{busy ? 'Mengirim pengajuan…' : 'Kirim pengajuan'}</Button>
            </fieldset>
          </form> : <p className={styles.intro}>Batas pengajuan periode ini telah berakhir. Kamu tetap bisa melihat status pengajuan di bawah.</p>}
        </>}
      </section>
      {data && !loading && <section className={styles.history} aria-labelledby="request-history"><h2 id="request-history">Pengajuanmu <span>{data.requests.length}</span></h2>{data.requests.length ? <ul>{data.requests.map(request => <li key={request.id}><div className={styles.requestTop}><h3>{request.title}</h3><strong>{money(request.amount)}</strong></div><div className={styles.requestMeta}><span className={styles[request.status.toLowerCase()]}>{statusLabels[request.status]}</span><time dateTime={request.submittedAt}>{date(request.submittedAt)} WIB</time></div>{request.reviewNote && <p className={styles.reviewNote}>Catatan pemeriksa: {request.reviewNote}</p>}</li>)}</ul> : <p className={styles.empty}>Belum ada pengajuan untuk periode ini.</p>}</section>}
      <footer className={styles.footer}>Clevio LMS · Pengajuan diperiksa oleh admin atau finance.</footer>
    </div>
  </main>;
}
