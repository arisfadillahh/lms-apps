'use client';
import { useEffect, useRef, useState } from 'react';
import { Copy, ExternalLink, Send, Link2, ReceiptText, ShieldCheck, MessageSquareText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatInvoicePeriod } from '@/lib/invoicePeriod';
import type { Invoice } from '@/lib/types/invoice';
import styles from './invoice-checkout-modal.module.css';

type Preview = { id: string; url: string; message: string; previewHash: string; sendState: string };
export default function InvoiceCheckoutModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const themeSource = useRef<HTMLSpanElement>(null);
  const [appearance, setAppearance] = useState({ theme: 'light', direction: 'playful' });
  const [invoices, setInvoices] = useState<Invoice[]>([]), [ids, setIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(true), [message, setMessage] = useState('');
  const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  useEffect(() => {
    // Radix portals live outside AdminChrome, so copy its theme attributes only.
    // Never copy user data, replace global styles, or change the shell's theme.
    const shell = themeSource.current?.closest('[data-admin-shell="true"]');
    if (!shell) return;
    const sync = () => setAppearance({ theme: shell.getAttribute('data-theme') || 'light', direction: shell.getAttribute('data-direction') || 'playful' });
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(shell, { attributes: true, attributeFilter: ['data-theme', 'data-direction'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/admin/invoice-checkouts?invoiceId=${encodeURIComponent(invoiceId)}`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat invoice.');
      setInvoices(data.invoices); setIds(data.invoices.map((i: Invoice) => i.id));
    }).catch(e => { if (e.name !== 'AbortError') setMessage(e.message); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [invoiceId]);
  async function create() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/invoice-checkouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceIds: ids }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat link.');
      setPreview(data);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Gagal membuat link.'); }
    finally { setBusy(false); }
  }
  async function send() {
    if (!preview) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/invoice-checkouts/${preview.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewHash: preview.previewHash }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mengirim pesan.');
      setPreview({ ...preview, sendState: 'SENT' });
      setMessage(data.skipped ? 'Pesan sudah dikirim hari ini atau sedang diproses. Tidak dikirim ulang.' : 'Pesan WhatsApp berhasil dikirim.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Status pengiriman belum pasti.'); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <span ref={themeSource} hidden />
    <DialogContent className={styles.dialog} data-admin-shell="true" data-theme={appearance.theme} data-direction={appearance.direction}>
      <div className={styles.header}>
        <span className={styles.headerIcon}><Link2 size={22} aria-hidden="true" /></span>
        <div><p className={styles.eyebrow}>PEMBAYARAN KELUARGA</p><DialogTitle className={styles.title}>Bayar tagihan pilihan</DialogTitle><DialogDescription className={styles.description}>Buat satu link untuk beberapa tagihan keluarga yang sama. Invoice lama tidak dilebur atau dihapus.</DialogDescription></div>
      </div>
      <ol className={styles.steps} aria-label="Langkah admin"><li data-current={!preview}><span>1</span> Pilih tagihan</li><li data-current={!!preview}><span>2</span> Preview & kirim</li></ol>
      <div className={styles.body}>
        {message && <p role="status" className={styles.notice}>{message}</p>}
        {busy && !invoices.length && <p className={styles.loading}><Loader2 size={18} aria-hidden="true" /> Memuat tagihan…</p>}
        {!preview ? <>
          <div className={styles.sectionHeading}><ReceiptText size={18} aria-hidden="true" /><h3>Tagihan yang disertakan</h3><span>{invoices.length}</span></div>
          <p className={styles.help}>Daftar mencakup seluruh bulan yang belum lunas, bukan hanya filter bulan di tabel. Semua dicentang default; orang tua tetap boleh memilih ulang sebelum membuat QR/VA.</p>
          <div className={styles.invoiceList}>
            {invoices.map(invoice => <label key={invoice.id} className={styles.invoice} data-selected={ids.includes(invoice.id)}>
              <input type="checkbox" checked={ids.includes(invoice.id)} disabled={busy} aria-label={`Sertakan ${formatInvoicePeriod(invoice)} ${invoice.invoice_number}`} onChange={e => setIds(e.target.checked ? [...ids, invoice.id] : ids.filter(id => id !== invoice.id))} />
              <span className={styles.invoiceText}><strong>{formatInvoicePeriod(invoice)}</strong><small>{invoice.invoice_number}</small><small className={styles.badge}>{invoice.status === 'OVERDUE' ? 'Menunggak' : 'Belum lunas'}</small></span>
              <strong className={styles.amount}>{money(invoice.total_amount)}</strong>
            </label>)}
          </div>
          {!busy && !invoices.length && <p className={styles.help}>Tidak ada tagihan yang dapat disertakan.</p>}
          <div className={styles.total} aria-live="polite"><span>{ids.length} tagihan dipilih<small>Sebelum biaya admin transaksi</small></span><strong>{money(invoices.filter(i => ids.includes(i.id)).reduce((sum, i) => sum + i.total_amount, 0))}</strong></div>
          <p className={styles.safety}><ShieldCheck size={17} aria-hidden="true" /> Membuat link tidak mengirim WhatsApp atau mengubah status pembayaran.</p>
        </> : <>
          <div className={styles.previewCard}>
            <div className={styles.sectionHeading}><Link2 size={18} aria-hidden="true" /><h3>Link pembayaran siap</h3></div>
            <p className={styles.help}>Tidak ada pesan yang dikirim otomatis. Cek halaman dan isi pesan sebelum mengirim.</p>
            <label className={styles.fieldLabel} htmlFor="checkout-payment-link">Link pembayaran</label>
            <input id="checkout-payment-link" aria-label="Link pembayaran" readOnly value={preview.url} className={styles.linkInput} onFocus={e => e.target.select()} />
            <div className={styles.linkActions}><a href={preview.url} target="_blank" rel="noreferrer" className="btn btn-sm"><ExternalLink size={16} /> Buka halaman ortu</a><button type="button" className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(preview.url); setMessage('Link disalin.'); } catch { setMessage('Salin link dari kolom di bawah.'); } }}><Copy size={16} /> Salin link</button></div>
          </div>
          <div className={styles.sectionHeading}><MessageSquareText size={18} aria-hidden="true" /><label htmlFor="checkout-wa-preview">Preview WhatsApp</label></div>
          <textarea id="checkout-wa-preview" readOnly value={preview.message} rows={10} className={styles.messagePreview} />
          <p className={styles.help}>Template dapat diatur di Pengaturan Invoice → Pembayaran beberapa tagihan. Pesan akan dicek ulang sebelum dikirim agar tagihan yang sudah lunas tidak ikut tertagih.</p>
        </>}
      </div>
      <div className={styles.footer}>
        <button type="button" disabled={busy} className="btn inline-flex min-h-11 items-center gap-2" onClick={onClose}>Tutup</button>
        {!preview ? <button type="button" disabled={busy || !ids.length} className="btn btn-primary inline-flex min-h-11 items-center gap-2" onClick={create}><Link2 size={16} />{busy ? 'Memproses…' : 'Buat link & preview'}</button>
          : <button type="button" className="btn btn-primary inline-flex min-h-11 items-center gap-2" disabled={busy || ['SENDING', 'UNCERTAIN'].includes(preview.sendState)} onClick={send}><Send size={16} />{busy ? 'Mengirim…' : 'Kirim ke orang tua'}</button>}
      </div>
    </DialogContent>
  </Dialog>;
}
