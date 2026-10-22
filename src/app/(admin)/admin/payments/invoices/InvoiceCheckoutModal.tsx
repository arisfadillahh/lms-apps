'use client';
import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Send, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatInvoicePeriod } from '@/lib/invoicePeriod';
import type { Invoice } from '@/lib/types/invoice';

type Preview = { id: string; url: string; message: string; previewHash: string; sendState: string };
export default function InvoiceCheckoutModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]), [ids, setIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(true), [message, setMessage] = useState('');
  const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
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
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl" style={{ background: 'var(--card, #fff)', color: 'var(--text, #172338)' }}>
      <div className="pr-8"><DialogTitle>Bayar tagihan pilihan</DialogTitle><DialogDescription className="mt-2">Buat satu link untuk beberapa tagihan keluarga yang sama. Invoice lama tidak dilebur atau dihapus.</DialogDescription></div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4">
        {message && <p role="status" className="rounded-lg border p-3 text-sm whitespace-pre-wrap">{message}</p>}
        {busy && !invoices.length && <p>Memuat tagihan…</p>}
        {!preview ? <>
          <p className="text-sm">Daftar mencakup seluruh bulan yang belum lunas, bukan hanya filter bulan di tabel. Semua dicentang default; orang tua tetap boleh memilih ulang sebelum membuat QR/VA.</p>
          <div className="divide-y rounded-lg border">
            {invoices.map(invoice => <label key={invoice.id} className="flex items-start gap-3 p-4 cursor-pointer">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={ids.includes(invoice.id)} disabled={busy} onChange={e => setIds(e.target.checked ? [...ids, invoice.id] : ids.filter(id => id !== invoice.id))} />
              <span className="min-w-0 flex-1 break-words"><strong>{formatInvoicePeriod(invoice)}</strong><small className="block opacity-70">{invoice.invoice_number}</small><small>{invoice.status === 'OVERDUE' ? 'Menunggak' : 'Belum lunas'}</small></span>
              <strong className="text-sm text-right">{money(invoice.total_amount)}</strong>
            </label>)}
          </div>
          <p className="text-sm font-semibold">{ids.length} tagihan · {money(invoices.filter(i => ids.includes(i.id)).reduce((sum, i) => sum + i.total_amount, 0))} sebelum biaya admin</p>
        </> : <>
          <p className="text-sm font-semibold">Link siap. Belum ada pesan yang dikirim otomatis.</p>
          <div className="flex flex-wrap gap-2"><a href={preview.url} target="_blank" rel="noreferrer" className="btn btn-sm"><ExternalLink size={16} /> Buka halaman ortu</a><button type="button" className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(preview.url); setMessage('Link disalin.'); } catch { setMessage('Salin link dari kolom di bawah.'); } }}><Copy size={16} /> Salin link</button></div>
          <input aria-label="Link pembayaran" readOnly value={preview.url} className="input w-full text-xs" onFocus={e => e.target.select()} />
          <label htmlFor="checkout-wa-preview" className="block text-sm font-semibold">Preview WhatsApp</label>
          <textarea id="checkout-wa-preview" readOnly value={preview.message} rows={12} className="input w-full resize-y whitespace-pre-wrap text-sm" style={{ minHeight: 180 }} />
          <p className="text-xs opacity-75">Template dapat diatur di Pengaturan Invoice → Pembayaran beberapa tagihan. Pesan akan dicek ulang sebelum dikirim agar tagihan yang sudah lunas tidak ikut tertagih.</p>
        </>}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4">
        <button type="button" disabled={busy} className="btn inline-flex min-h-11 items-center gap-2" onClick={onClose}>Tutup</button>
        {!preview ? <button type="button" disabled={busy || !ids.length} className="btn btn-primary inline-flex min-h-11 items-center gap-2" onClick={create}><Link2 size={16} />{busy ? 'Memproses…' : 'Buat link & preview'}</button>
          : <button type="button" className="btn btn-primary inline-flex min-h-11 items-center gap-2" disabled={busy || ['SENDING', 'UNCERTAIN'].includes(preview.sendState)} onClick={send}><Send size={16} />{busy ? 'Mengirim…' : 'Kirim ke orang tua'}</button>}
      </div>
    </DialogContent>
  </Dialog>;
}
