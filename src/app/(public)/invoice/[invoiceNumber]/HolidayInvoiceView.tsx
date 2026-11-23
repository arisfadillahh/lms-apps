'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, CheckCircle2, Copy, Download, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import type { PublicInvoice } from '@/lib/publicInvoice';
import type { PublicInvoicePaymentInstruction, PublicInvoicePaymentOption } from '@/lib/invoicePaymentMethods';
import { trackHolidayEventWhenReady } from '@/lib/metaPixel';
import styles from './HolidayInvoiceView.module.css';

type Props={ invoice:PublicInvoice; token:string; options:PublicInvoicePaymentOption[]; initialPayment:PublicInvoicePaymentInstruction|null; initialExpiresAt?:string|null; csPhone:string|null };
const rupiah=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const date=(s:string)=>new Date(s).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});

export default function HolidayInvoiceView({invoice,token,options,initialPayment,initialExpiresAt,csPhone}:Props) {
  const priority=['bni_va','bri_va','qris','bsi_va','mandiri_bill','permata_va','cimb_va','other_va'];
  const available=options.filter(o=>!o.disabled).sort((a,b)=>priority.indexOf(a.code)-priority.indexOf(b.code));
  const [method,setMethod]=useState(initialPayment?.method??available[0]?.code??'');
  const [payment,setPayment]=useState(initialPayment);
  const [expiry,setExpiry]=useState(initialExpiresAt??invoice.midtrans_expires_at??null);
  const [now,setNow]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [feedback,setFeedback]=useState('');
  const [choosing,setChoosing]=useState(!initialPayment);
  const paid=invoice.status==='PAID';
  const expired=Boolean(expiry&&now&&Date.parse(expiry)<=now);
  const option=available.find(o=>o.code===method);
  const displayFee=paid?(invoice.payment_admin_fee??initialPayment?.adminFee??0):(choosing?option?.adminFee:payment?.adminFee)??0;
  const displayTotal=paid?(invoice.payment_total_amount??initialPayment?.total??invoice.total_amount):(choosing?option?.total:payment?.total)??invoice.total_amount;
  const cs=csPhone?`https://wa.me/${csPhone}?text=${encodeURIComponent(`Halo Clevio, saya perlu bantuan invoice ${invoice.invoice_number}.`)}`:null;

  useEffect(()=>{const first=setTimeout(()=>setNow(Date.now()),0);const timer=setInterval(()=>setNow(Date.now()),30_000);return()=>{clearTimeout(first);clearInterval(timer);};},[]);
  useEffect(()=>{
    const key=`clevio-holiday-registration:${location.pathname}`;
    try {
      const id=sessionStorage.getItem(key);
      if(!id||!/^[a-f0-9-]{36}$/i.test(id)||localStorage.getItem('clevio-holiday-analytics')==='no')return;
      void trackHolidayEventWhenReady('CompleteRegistration',id).then(sent=>{if(sent)sessionStorage.removeItem(key);});
    } catch { /* Storage is optional; server measurement remains independent. */ }
  },[]);

  async function choosePayment() {
    if(!option||busy)return;
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/payment-method`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,token}),signal:AbortSignal.timeout(45000)});
      const data=await response.json();
      if(!response.ok||!data.payment)throw new Error(data.error||'Instruksi pembayaran belum tersedia. Coba lagi.');
      setPayment(data.payment);setExpiry(data.expiresAt??null);setChoosing(false);setFeedback('');
      try {if(data.eventId&&localStorage.getItem('clevio-holiday-analytics')!=='no')void trackHolidayEventWhenReady('InitiateCheckout',data.eventId,data.payment.total);} catch { /* Optional browser storage. */ }
    } catch(e) {setError(e instanceof DOMException&&e.name==='TimeoutError'?'Instruksi masih diproses. Coba lagi untuk melanjutkan pembayaran yang sama.':e instanceof Error?e.message:'Pembayaran belum dapat diproses.');}
    finally {setBusy(false);}
  }
  async function copy(value:string) {
    try{await navigator.clipboard.writeText(value);setFeedback('Nomor pembayaran disalin.');}
    catch{setFeedback('Belum bisa menyalin otomatis. Salin nomor di atas.');}
  }

  return <main lang="id" className={styles.page}>
    <header className={styles.header}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/innovator-camp-logo-dark.png" alt="Clevio Innovator Camp" width="154" height="52" />
      <a href="/holiday-class/"><ArrowLeft size={16}/> Holiday Class</a>
    </header>
    <div className={styles.layout}>
      <section className={styles.order} aria-labelledby="order-title">
        <p className={styles.eyebrow}>HOLIDAY CLASS 2026 / 2027</p>
        <h1 id="order-title">Kelas pilihan {invoice.seasonal_student_name}</h1>
        <p className={styles.muted}>Invoice {invoice.invoice_number} · Terbit {date(invoice.created_at)}</p>
        {!paid&&<a className={styles.jump} href="#holiday-payment">Pilih cara bayar ↓</a>}
        <div className={styles.recipient}><span>Orang tua</span><strong>{invoice.parent_name}</strong></div>
        <ul className={styles.items}>{invoice.items?.map(item=><li key={item.id}>
          <div><h2>{item.class_name}</h2><p>{item.description}</p></div><strong>{rupiah(item.final_price)}</strong>
        </li>)}</ul>
        <dl className={styles.total}><div><dt>Total kelas</dt><dd>{rupiah(invoice.total_amount)}</dd></div>
          <div><dt>Biaya admin</dt><dd>{rupiah(displayFee)}</dd></div>
          <div className={styles.grand}><dt>Total pembayaran</dt><dd>{rupiah(displayTotal)}</dd></div>
        </dl>
        <details className={styles.terms}><summary>Lihat ketentuan</summary><p>Pembayaran dikonfirmasi otomatis setelah berhasil diproses. Biaya admin ditampilkan sebelum metode dipilih. Jadwal kelas mengikuti pesanan di atas. Hubungi tim Clevio jika membutuhkan bantuan atau perubahan pesanan.</p></details>
      </section>
      <section id="holiday-payment" className={styles.checkout} aria-labelledby="payment-title">
        {paid?<><span className={styles.paidIcon}><CheckCircle2 size={38}/></span><h2 id="payment-title">Pembayaran diterima</h2><p>Terima kasih, Ayah/Bunda. Pendaftaran {invoice.seasonal_student_name} sudah lunas.</p>{invoice.paid_at&&<p className={styles.date}><CalendarDays size={17}/>{date(invoice.paid_at)}</p>}<p>Konfirmasi juga dikirim ke WhatsApp orang tua.</p></>:<>
          <span className={styles.status}>Menunggu pembayaran</span><h2 id="payment-title">Selesaikan pendaftaran</h2>
          <p className={styles.muted}>Pilih cara bayar yang paling mudah. Biaya admin sudah termasuk dalam total.</p>
          {choosing?<form onSubmit={e=>{e.preventDefault();void choosePayment();}}>
            <fieldset className={styles.methods} disabled={busy}><legend>Metode pembayaran</legend>{available.slice(0,3).map(o=><label key={o.code} className={styles.method}>
              <input type="radio" name="method" value={o.code} checked={method===o.code} onChange={()=>setMethod(o.code)}/>
              <span><strong>{o.label}</strong><small>Biaya admin {rupiah(o.adminFee)}</small></span><strong>{rupiah(o.total)}</strong>
            </label>)}{available.length>3&&<details className={styles.terms} open={available.slice(3).some(o=>o.code===method)}><summary>Bank lainnya</summary>{available.slice(3).map(o=><label key={o.code} className={styles.method}>
              <input type="radio" name="method" value={o.code} checked={method===o.code} onChange={()=>setMethod(o.code)}/>
              <span><strong>{o.label}</strong><small>Biaya admin {rupiah(o.adminFee)}</small></span><strong>{rupiah(o.total)}</strong>
            </label>)}</details>}</fieldset>
            <button className={styles.primary} disabled={busy||!option}>{busy?'Menyiapkan pembayaran…':'Tampilkan pembayaran'}</button>
          </form>:payment&&<div className={styles.instructions}>
            <h3>{payment.label}</h3><p className={styles.payAmount}>{rupiah(payment.total)}</p>
            {expiry&&<p className={styles.muted}>{expired?'Instruksi sudah kedaluwarsa':'Berlaku sampai '+new Date(expiry).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB'}</p>}
            {expired?<button className={styles.primary} disabled={busy} onClick={()=>void choosePayment()}><RefreshCw size={18}/>{busy?'Menyiapkan…':payment.method==='qris'?'Buat QR baru':'Buat instruksi baru'}</button>:<>
              {payment.vaNumber&&<><p>Nomor Virtual Account</p><output className={styles.number}>{payment.vaNumber}</output><button className={styles.secondary} onClick={()=>void copy(payment.vaNumber!)}><Copy size={16}/>Salin nomor</button></>}
              {payment.billerCode&&<p>Kode perusahaan: <strong>{payment.billerCode}</strong></p>}
              {payment.billKey&&<><output className={styles.number}>{payment.billKey}</output><button className={styles.secondary} onClick={()=>void copy(payment.billKey!)}><Copy size={16}/>Salin kode pembayaran</button></>}
              {payment.qrImageUrl&&<><div className={styles.qr}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payment.qrImageUrl} alt="QRIS pembayaran Holiday Class" width="240" height="240" onError={()=>setError('QR belum dapat dimuat. Muat ulang invoice atau hubungi tim Clevio.')}/>
              </div><a className={styles.secondary} href={payment.qrImageUrl} download={`QRIS-${invoice.invoice_number}.png`}><Download size={17}/>Simpan QR</a><p className={styles.muted}>Pindai dari HP lain, atau impor gambar QR di aplikasi pembayaran yang mendukung.</p></>}
              {payment.deeplinkUrl&&/^https:\/\//.test(payment.deeplinkUrl)&&<a className={styles.primary} href={payment.deeplinkUrl}>Buka aplikasi pembayaran</a>}
            </>}
            <button className={styles.textButton} disabled={busy} onClick={()=>setChoosing(true)}>Ganti metode pembayaran</button>
          </div>}
          <p className={styles.safe}><ShieldCheck size={17}/>Status lunas diperbarui otomatis.</p>
          <button className={styles.textButton} onClick={()=>location.reload()}><RefreshCw size={15}/>Sudah bayar? Periksa status</button>
        </>}
        {error&&<p role="alert" className={styles.error}>{error}</p>}{feedback&&<p role="status"><Check size={16}/>{feedback}</p>}
        {cs&&<a href={cs} target="_blank" rel="noopener noreferrer" className={styles.help}><MessageCircle size={19}/>Butuh bantuan? Chat CS</a>}
      </section>
    </div>
    <footer className={styles.footer}>Clevio Innovator Camp · Belajar lewat project</footer>
  </main>;
}
