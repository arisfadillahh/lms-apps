'use client';

import { Bug, Check, ImagePlus, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import styles from './IssueReportButton.module.css';

type Props = { role: 'ADMIN' | 'COACH' | 'CODER' };

export default function IssueReportButton({ role }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(screenshot);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [screenshot]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titleRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, submitting]);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPageUrl('');
    setScreenshot(null);
    setError(null);
    setReference(null);
    setWarning(null);
  };

  const close = () => {
    if (submitting) return;
    setOpen(false);
    reset();
  };

  const selectScreenshot = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Screenshot harus berupa PNG, JPG, atau WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran screenshot maksimal 5 MB.');
      return;
    }
    setScreenshot(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set('title', title);
      form.set('description', description);
      form.set('pageUrl', pageUrl.trim());
      form.set('viewportWidth', String(window.innerWidth));
      form.set('viewportHeight', String(window.innerHeight));
      if (screenshot) form.set('screenshot', screenshot);

      const response = await fetch('/api/issue-reports', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Report belum berhasil dikirim');
      setReference(payload.reference);
      setWarning(payload.warning || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Report belum berhasil dikirim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-label="Laporkan masalah LMS">
        <Bug size={18} /> <span className={styles.triggerLabel}>Laporkan Masalah</span>
      </button>

      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="issue-report-title">
            {reference ? (
              <div className={styles.success}>
                <div className={styles.successIcon}><Check size={30} /></div>
                <h3>Report sudah terkirim</h3>
                <p>Tim Clevio sudah menerima detail masalah dan konteks teknis yang kamu kirim.</p>
                {warning ? <p className={styles.error}>{warning}</p> : null}
                <div className={styles.reference}>{reference}</div>
                <div><button type="button" className={styles.submit} onClick={close}>Selesai</button></div>
              </div>
            ) : (
              <>
                <header className={styles.header}>
                  <div className={styles.heading}>
                    <div className={styles.iconBox}><Bug size={22} /></div>
                    <div>
                      <h2 className={styles.title} id="issue-report-title">Laporkan Masalah LMS</h2>
                      <p className={styles.subtitle}>Jelaskan kendalanya agar tim bisa mengecek dengan cepat.</p>
                    </div>
                  </div>
                  <button type="button" className={styles.close} onClick={close} aria-label="Tutup"><X size={18} /></button>
                </header>

                <form className={styles.form} onSubmit={submit}>
                  <label className={styles.field}>
                    <span className={styles.label}>Judul masalah</span>
                    <input ref={titleRef} className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} minLength={5} maxLength={120} placeholder="Contoh: Tombol simpan penilaian tidak merespons" required />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Ceritakan masalahnya</span>
                    <textarea className={styles.textarea} value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={3000} placeholder="Tuliskan apa yang dilakukan, hasil yang muncul, dan seharusnya bagaimana." required />
                    <span className={styles.hint}>Ukuran layar dan perangkat akan dicatat otomatis.</span>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Halaman terkait <span className={styles.hint}>(opsional)</span></span>
                    <input className={styles.input} value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} maxLength={1000} placeholder="Contoh: Dashboard Coach atau /coach/classes/123" />
                    <span className={styles.hint}>Isi halaman tempat masalah terlihat agar tim bisa menemukannya dengan lebih akurat.</span>
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Screenshot <span className={styles.hint}>(opsional)</span></span>
                    <span className={styles.upload}>
                      <span className={styles.uploadIcon}><ImagePlus size={22} /></span>
                      <span>
                        <span className={styles.fileName}>{screenshot?.name || 'Pilih gambar dari perangkat'}</span>
                        <span className={styles.hint} style={{ display: 'block', marginTop: 3 }}>PNG, JPG, atau WebP, maksimal 5 MB.</span>
                      </span>
                      <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => selectScreenshot(event.target.files?.[0])} />
                    </span>
                  </label>
                  {previewUrl ? <img className={styles.preview} src={previewUrl} alt="Preview screenshot masalah" /> : null}
                  {error ? <p className={styles.error} role="alert">{error}</p> : null}
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondary} onClick={close} disabled={submitting}>Batal</button>
                    <button type="submit" className={styles.submit} disabled={submitting}>
                      {submitting ? 'Mengirim...' : <><Send size={15} style={{ display: 'inline', marginRight: 7, verticalAlign: -2 }} />Kirim Report</>}
                    </button>
                  </div>
                  <input type="hidden" value={role} readOnly />
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
