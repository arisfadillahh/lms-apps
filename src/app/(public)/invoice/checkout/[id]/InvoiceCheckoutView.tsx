'use client';

import { useState } from 'react';
import { CheckCircle2, ShieldCheck, ReceiptText, RefreshCw, Copy, ArrowRight } from 'lucide-react';
import { calculateInvoicePaymentAdminFee, type PublicInvoicePaymentOption } from '@/lib/invoicePaymentMethods';
import { checkoutSelectedTotal, defaultCheckoutSelection, type CheckoutInvoice } from '@/lib/invoiceCheckout';
import styles from './checkout.module.css';

export interface CheckoutViewData {
  invoices: CheckoutInvoice[]; options: PublicInvoicePaymentOption[]; enabled: boolean; hasOtherActive: boolean;
  active: Array<{ orderId: string; state: string; invoiceIds: string[]; total: number; adminFee: number; payment: {
    method: string; label: string; baseAmount: number; adminFee: number; total: number; feeLabel: string;
    bank: string | null; vaNumber: string | null; billerCode: string | null; billKey: string | null; qrImageUrl: string | null;
  } | null }>;
}
const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export default function InvoiceCheckoutView({ id, token, initialData }: { id: string; token: string; initialData: CheckoutViewData }) {
  const [data, setData] = useState(initialData);
  const [selected, setSelected] = useState(initialData.active[0]?.invoiceIds ?? defaultCheckoutSelection(initialData.invoices));
  const [method, setMethod] = useState(initialData.options[0]?.code ?? 'qris');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const active = data.active[0], allPaid = data.invoices.every(i => i.status === 'PAID');
  let base = 0;
  try { base = checkoutSelectedTotal(data.invoices, selected); } catch { /* no valid selection */ }
  const option = data.options.find(o => o.code === method);
  const fee = option ? calculateInvoicePaymentAdminFee(base, option) : 0;
  const locked = !!active || busy;
  async function action(payload?: Record<string, unknown>) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/invoice-checkouts/${id}${payload ? '' : `?t=${encodeURIComponent(token)}`}`, payload ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, token }),
      } : { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Permintaan gagal.');
      const fresh = result as CheckoutViewData;
      setData(fresh);
      setSelected(fresh.active[0]?.invoiceIds ?? selected.filter(invoiceId => fresh.invoices.some(i => i.id === invoiceId && i.status !== 'PAID')));
      if (payload?.action === 'cancel' && !fresh.active.length) setMessage('Instruksi lama sudah dibatalkan. Silakan ubah pilihan tagihan.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Gagal memuat status.');
      // A charge timeout may have reserved an order. Refresh read-only so controls
      // remain locked even when the provider request's response was lost.
      if (payload?.action === 'pay') {
        const response = await fetch(`/api/invoice-checkouts/${id}?t=${encodeURIComponent(token)}`, { cache: 'no-store' }).catch(() => null);
        if (response?.ok) { const fresh = await response.json() as CheckoutViewData; setData(fresh); if (fresh.active[0]) setSelected(fresh.active[0].invoiceIds); }
      }
    } finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage('Nomor pembayaran disalin.'); }
    catch { setMessage('Tidak dapat menyalin otomatis. Pilih dan salin nomor yang tampil.'); }
  }
  return <main className={styles.page}>
    <div className={styles.container}>
      <header className={styles.header}><span className={styles.brand}>CLEVIO</span><span><ShieldCheck size={16} /> Pembayaran kelas</span></header>
      <section className={styles.intro}>
        <div className={styles.icon}><ReceiptText size={25} /></div>
        <p className={styles.eyebrow}>TAGIHAN KELAS</p>
        <h1>{allPaid ? 'Semua tagihan sudah lunas' : 'Pilih tagihan yang ingin dibayar'}</h1>
        <p>{allPaid ? 'Terima kasih. Tidak ada pembayaran lagi untuk daftar ini.' : 'Semua tagihan belum lunas dipilih otomatis. Anda boleh membayar satu tagihan dahulu atau beberapa sekaligus.'}</p>
      </section>
      {message && <div role="status" className={styles.notice}>{message}</div>}
      {!data.enabled && !allPaid && <div role="alert" className={styles.notice}>Pembayaran baru sedang dinonaktifkan. Instruksi aktif tetap dapat diperiksa; hubungi admin untuk bantuan.</div>}
      {data.hasOtherActive && <div role="alert" className={styles.notice}>Ada instruksi aktif dari link invoice lain. Selesaikan instruksi tersebut atau hubungi admin sebelum membuat pembayaran baru.</div>}
      <section className={styles.card} aria-label="Daftar tagihan">
        <div className={styles.cardTitle}><h2>Rincian tagihan</h2>{!allPaid && <button type="button" disabled={locked} onClick={() => setSelected(defaultCheckoutSelection(data.invoices))}>Pilih semua</button>}</div>
        {data.invoices.map(invoice => <label key={invoice.id} className={styles.invoice}>
          <input type="checkbox" aria-label={`Bayar ${invoice.periodLabel} ${invoice.invoice_number}`} checked={selected.includes(invoice.id) && invoice.status !== 'PAID'} disabled={locked || invoice.status === 'PAID'} onChange={e => setSelected(e.target.checked ? [...selected, invoice.id] : selected.filter(x => x !== invoice.id))} />
          <span className={styles.invoiceText}><strong>{invoice.periodLabel}</strong><small>{invoice.invoice_number}</small><small>{invoice.coderNames.join(', ')}</small>
            <span className={invoice.status === 'PAID' ? styles.paid : styles.unpaid}>{invoice.status === 'PAID' ? 'Lunas' : invoice.status === 'OVERDUE' ? 'Menunggak' : 'Belum lunas'}</span>
          </span><strong className={styles.amount}>{money(invoice.total_amount)}</strong>
        </label>)}
      </section>
      {!allPaid && !active && <section className={styles.card}>
        <h2>Metode pembayaran</h2>
        <label htmlFor="payment-method">Pilih QRIS atau bank</label>
        <select id="payment-method" value={method} disabled={locked} onChange={e => setMethod(e.target.value as typeof method)}>
          {data.options.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
        </select>
        <p className={styles.hint}>{option?.description}</p>
        <div className={styles.summary}><span>Tagihan terpilih ({selected.length})</span><strong>{money(base)}</strong><span>Biaya admin transaksi</span><strong>{money(fee)}</strong></div>
        <p className={styles.hint}>Biaya admin berlaku satu kali untuk transaksi ini. Pilihan tagihan dikunci setelah instruksi dibuat.</p>
      </section>}
      {active && <section className={styles.card} aria-label="Instruksi pembayaran">
        <h2>{active.state === 'REVIEW' ? 'Pembayaran perlu pemeriksaan admin' : active.payment?.label ?? 'Instruksi sedang dikonfirmasi'}</h2>
        {active.state === 'REVIEW' ? <p>Jangan membayar ulang. Admin perlu memeriksa kecocokan pembayaran dan periode belajar.</p> : active.payment ? <>
          <p>Bayar tepat sejumlah <strong>{money(active.total)}</strong>, termasuk biaya admin {money(active.adminFee)}.</p>
          {active.payment.qrImageUrl && <><p>Scan dengan mobile banking atau dompet digital yang mendukung QRIS.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.qr} src={active.payment.qrImageUrl} alt="QRIS untuk tagihan terpilih" />
            <a href={active.payment.qrImageUrl} download="qris-tagihan.png">Unduh QRIS</a></>}
          {[['Nomor Virtual Account', active.payment.vaNumber], ['Biller Code', active.payment.billerCode], ['Bill Key', active.payment.billKey]].map(([label, value]) => value ? <div className={styles.copyRow} key={label}><span>{label}<strong>{value}</strong></span><button type="button" onClick={() => copy(value)} aria-label={`Salin ${label}`}><Copy size={18} /></button></div> : null)}
        </> : <p>Jika pembuatan instruksi terputus, jangan membuat transaksi lain. Periksa status atau hubungi admin.</p>}
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => action({ action: 'refresh', orderId: active.orderId })}><RefreshCw size={16} /> Periksa status</button>
          {active.state !== 'REVIEW' && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Batalkan instruksi pembayaran ini? Pilihan baru hanya dibuka setelah gateway memastikan pembatalan. Jangan lanjutkan jika Anda sudah membayar.')) void action({ action: 'cancel', orderId: active.orderId }); }}>Batalkan & ubah pilihan</button>}</div>
      </section>}
      {allPaid ? <div className={styles.complete}><CheckCircle2 /> Pembayaran untuk daftar ini telah selesai.</div> : !active && <footer className={styles.footer}><div><small>{selected.length} tagihan · {option?.label}<br />Termasuk biaya admin {money(fee)}</small><strong>{money(base + fee)}</strong></div>
        <button type="button" disabled={busy || !base || !data.enabled || data.hasOtherActive} onClick={() => action({ action: 'pay', invoiceIds: selected, method, expectedBase: base })}>{busy ? 'Memproses…' : 'Buat instruksi pembayaran'}<ArrowRight size={18} /></button></footer>}
      <p className={styles.hint}>Status lunas diperbarui setelah pembayaran dikonfirmasi. Membuka link atau membuat instruksi tidak menambah masa belajar.</p>
      <button className={styles.reload} type="button" disabled={busy} onClick={() => action()}>Muat ulang daftar tagihan</button>
    </div>
  </main>;
}
