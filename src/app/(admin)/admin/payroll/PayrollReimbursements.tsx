'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ExternalLink, ReceiptText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { dateWib, rupiah } from '@/lib/payroll/presentation';
import shared from './PayrollAdmin.module.css';
import styles from './PayrollReimbursements.module.css';

type Request = {
  id: string; profileId: string; recipientName: string; periodId: string; title: string; amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; revision: number; submittedAt: string; reviewNote?: string | null; evidenceUrl: string;
};
const labels = { PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };

export default function PayrollReimbursements({ periodId, canReview, onChanged }: { periodId: string; canReview: boolean; onChanged: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false), [requests, setRequests] = useState<Request[]>([]), [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('PENDING'), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [reason, setReason] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const reasonInput = useRef<HTMLTextAreaElement>(null), sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const response = await fetch(`/api/admin/payroll/reimbursements?period=${encodeURIComponent(periodId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Gagal memuat reimbursement.');
      if (current === sequence.current) setRequests(body.requests);
    } catch (cause) { if (current === sequence.current) throw cause; }
    finally { if (current === sequence.current) setLoading(false); }
  }, [periodId]);
  const cancelRequests = useCallback(() => { sequence.current++; }, []);
  useEffect(() => cancelRequests, [cancelRequests]);
  const request = requests.find(item => item.id === selected);
  const visible = requests.filter(item => status === 'ALL' || item.status === status);
  const pending = requests.filter(item => item.status === 'PENDING').length;
  function choose(item: Request) {
    setSelected(item.id); setReason(''); setDecision(item.status === 'APPROVED' ? 'REJECTED' : 'APPROVED'); setError(''); setMessage('');
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request || !canReview || busy) return;
    if (reason.trim().length < 5) { setError('Isi alasan keputusan minimal 5 karakter.'); reasonInput.current?.focus(); return; }
    setBusy(true); setError(''); setMessage('');
    let saved = false;
    try {
      const response = await fetch('/api/admin/payroll/reimbursements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id, revision: request.revision, status: decision, reason: reason.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Keputusan belum tersimpan.');
      saved = true;
      setRequests(previous => previous.map(item => item.id === body.request.id ? body.request : item));
      setSelected(null); setReason('');
      await load();
      await onChanged();
      setMessage(decision === 'APPROVED' ? 'Disetujui. Reimbursement sudah masuk ke rekap penerima.' : 'Ditolak. Rekap penerima sudah diperbarui.');
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Coba muat ulang halaman.';
      setError(saved ? `Keputusan tersimpan. Rekap belum berhasil diperbarui; klik Perbarui rekap. ${detail}` : detail);
      if (!saved) await load().catch(() => undefined);
    } finally { setBusy(false); }
  }
  return <>
    <Button size="sm" variant="outline" onClick={() => { setSelected(null); setError(''); setMessage(''); setRequests([]); setLoading(true); setOpen(true); void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Gagal memuat reimbursement.')); }}><ReceiptText aria-hidden="true" />Reimbursement</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) { if (!value) cancelRequests(); setOpen(value); } }}>
      <DialogContent className={`${shared.modal} ${styles.modal}`}>
        <DialogHeader className={shared.modalHeader}><DialogTitle>Reimbursement</DialogTitle><DialogDescription>Periode {periodId} · Admin atau finance memeriksa bukti sebelum masuk payroll.</DialogDescription></DialogHeader>
        <div className={`${shared.modalBody} ${styles.body}`}>
          {error && <p role="alert" className={styles.error}>{error}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
          {request ? <div className={styles.review}>
            <Button size="sm" variant="ghost" className={styles.back} disabled={busy} onClick={() => { setSelected(null); setError(''); }}><ArrowLeft aria-hidden="true" />Daftar pengajuan</Button>
            <div className={styles.summary}><div><p>{request.recipientName}</p><h2>{request.title}</h2><span>{dateWib(request.submittedAt)} WIB · {labels[request.status]}</span></div><strong>{rupiah(request.amount)}</strong></div>
            <a className={styles.evidence} href={request.evidenceUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink aria-hidden="true" />Lihat foto bukti<span>Buka ukuran penuh</span></a>
            {request.reviewNote && <p className={styles.reviewNote}><strong>Keputusan sebelumnya</strong>{request.reviewNote}</p>}
            {canReview ? <form id="reimbursement-review-form" onSubmit={review} aria-label="Keputusan reimbursement">
              <fieldset disabled={busy}>
                <label htmlFor="reimbursement-decision">Keputusan<select id="reimbursement-decision" aria-label="Keputusan" value={decision} onChange={event => setDecision(event.target.value as 'APPROVED' | 'REJECTED')}><option value="APPROVED">Setujui pengeluaran</option><option value="REJECTED">Tolak pengeluaran</option></select></label>
                <label htmlFor="reimbursement-reason">Alasan keputusan<textarea ref={reasonInput} id="reimbursement-reason" required minLength={5} maxLength={1000} rows={3} placeholder="Contoh: Nota sesuai kebutuhan kelas dan nominal benar." value={reason} onChange={event => setReason(event.target.value)} /></label>
                <p className={styles.hint}>Nominal mengikuti pengajuan. Persetujuan menambahkan komponen reimbursement ke rekap; penolakan menghapus komponen tersebut.</p>
              </fieldset>
            </form> : <p className={styles.hint}>Persetujuan hanya dapat dilakukan admin atau finance.</p>}
          </div> : <>
            <div className={styles.toolbar}><label htmlFor="reimbursement-filter">Status<select id="reimbursement-filter" aria-label="Status" value={status} disabled={busy} onChange={event => setStatus(event.target.value)}><option value="PENDING">Menunggu ({pending})</option><option value="APPROVED">Disetujui</option><option value="REJECTED">Ditolak</option><option value="ALL">Semua pengajuan</option></select></label><Button size="sm" variant="ghost" aria-label="Muat ulang reimbursement" disabled={loading || busy} onClick={() => { setError(''); setLoading(true); void load().catch(cause => setError(cause instanceof Error ? cause.message : 'Gagal memuat reimbursement.')); }}><RefreshCw aria-hidden="true" /></Button></div>
            {loading ? <p role="status" className={styles.empty}>Memuat pengajuan…</p> : visible.length ? <ul className={styles.list}>{visible.map(item => <li key={item.id}><div><strong>{item.recipientName}</strong><p>{item.title}</p><span>{labels[item.status]} · {dateWib(item.submittedAt)} WIB</span></div><div className={styles.itemAction}><strong>{rupiah(item.amount)}</strong><Button size="sm" variant="outline" disabled={busy} onClick={() => choose(item)}>{canReview ? 'Tinjau' : 'Lihat detail'}</Button></div></li>)}</ul> : <div className={styles.empty}><ReceiptText aria-hidden="true" /><p>{status === 'PENDING' ? 'Tidak ada pengajuan yang menunggu pemeriksaan.' : 'Belum ada pengajuan dengan status ini.'}</p></div>}
          </>}
        </div>
        {request && canReview && <div className={styles.footer}><Button form="reimbursement-review-form" type="submit" disabled={busy}>{busy ? 'Menyimpan keputusan…' : decision === 'APPROVED' ? 'Setujui reimbursement' : 'Tolak reimbursement'}</Button></div>}
      </DialogContent>
    </Dialog>
  </>;
}
