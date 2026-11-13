import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({browser:vi.fn(),stored:vi.fn(),bsiId:vi.fn()}));
vi.mock('@/lib/invoiceSnapBrowser',()=>({issueSnapInBrowser:m.browser}));
vi.mock('@/lib/invoicePaymentStore',()=>({getStoredInvoicePaymentByInvoiceId:m.stored}));
vi.mock('@/lib/midtransSnapTransaction',()=>({verifiedSnapTransactionId:m.bsiId}));
import { InvoiceMidtransClient, normalizeSnapPayment, validQrPayload } from '@/lib/invoiceMidtransClient';
import { withInvoiceIssuance } from '@/lib/invoiceIssuanceJournal';
import { renderInvoicePaymentQr } from '@/lib/invoicePaymentQr';
import { buildInvoicePaymentBreakdown } from '@/lib/invoicePaymentMethods';
import type { Invoice } from '@/lib/types/invoice';
import { testQr } from './fixtures/paymentQr';
const invoice={id:'local-qa-invoice',invoice_number:'QA-LOCAL',total_amount:100000,items:[]} as unknown as Invoice;
const payment=buildInvoicePaymentBreakdown('bni_va',100000)!;
const raw=(order='LOCAL-1')=>({order_id:order,gross_amount:'102500.00',transaction_id:'local-id',transaction_status:'pending',status_code:'201',payment_type:'bank_transfer',va_numbers:[{bank:'bni',va_number:'123456789012'}]});
let dir:string;
beforeEach(async()=>{
    vi.resetAllMocks();dir=await mkdtemp(path.join(os.tmpdir(),'clevio-snap-test-'));vi.stubEnv('LMS_INVOICE_ISSUANCE_DIR',dir);
    vi.stubEnv('MIDTRANS_SERVER_KEY','SB-Mid-server-LOCAL-TEST');vi.stubEnv('MIDTRANS_IS_PRODUCTION','false');
    m.stored.mockResolvedValue(null);m.browser.mockResolvedValue(raw());
});
afterEach(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await rm(dir,{recursive:true,force:true});});

describe('durable normal-Snap issuance',()=>{
    it('persists and resumes the same issued order on retry, without another Snap transaction or browser',async()=>{
        const http=vi.fn(async(url:string)=>Response.json(url.endsWith('/snap/v1/transactions')?{token:'local-snap-token'}:raw()));vi.stubGlobal('fetch',http);
        const first=await new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-1');
        const retry=await new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-NEW-UNUSED');
        expect(first).toEqual(retry);expect(m.browser).toHaveBeenCalledTimes(1);expect(http.mock.calls.filter(([u])=>u.endsWith('/snap/v1/transactions'))).toHaveLength(1);
        expect(m.browser).toHaveBeenCalledWith('local-snap-token',false);
    });
    it('resumes the saved Snap token after a browser timeout without creating a second order',async()=>{
        vi.stubGlobal('fetch',vi.fn(async()=>Response.json({token:'local-snap-token'})));
        m.browser.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(raw());
        await expect(new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-1')).rejects.toThrow('timeout');
        expect((await new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-2')).orderId).toBe('LOCAL-1');
        expect(fetch).toHaveBeenCalledTimes(1);expect(m.browser).toHaveBeenCalledTimes(2);
    });
    it('does not retry an ambiguous Snap creation even across a fresh client instance',async()=>{
        vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('network lost');}));
        await expect(new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-1')).rejects.toThrow();
        await expect(new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-2')).rejects.toThrow('diperiksa admin');
        expect(fetch).toHaveBeenCalledTimes(1);expect(m.browser).not.toHaveBeenCalled();
    });
    it('blocks a concurrent request before it can call the gateway',async()=>{
        let release!:()=>void;let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);
        const held=withInvoiceIssuance(invoice.id,async()=>{entered();await new Promise<void>(r=>release=r);});
        await ready;vi.stubGlobal('fetch',vi.fn());
        await expect(new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-1')).rejects.toThrow('sedang dibuat');
        expect(fetch).not.toHaveBeenCalled();release();await held;
    });
    it('never accepts a wrong order or amount, leaving the original token recoverable',async()=>{
        vi.stubGlobal('fetch',vi.fn(async()=>Response.json({token:'local-snap-token'})));
        m.browser.mockResolvedValueOnce({...raw(),gross_amount:'1.00'});
        await expect(new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-1')).rejects.toThrow('berbeda');
        expect((await new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-2')).orderId).toBe('LOCAL-1');
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('waits for confirmed cancellation before changing methods, and respects a settlement race',async()=>{
        const existing={invoiceId:invoice.id,orderId:'LOCAL-OLD',method:'bri_va',total:102500,paymentDetails:{method:'bri_va',bank:'bri'}};
        m.stored.mockResolvedValue(existing);
        const http=vi.fn().mockResolvedValueOnce(Response.json(raw('LOCAL-OLD')))
            .mockResolvedValueOnce(Response.json({...raw('LOCAL-OLD'),transaction_status:'cancel'}))
            .mockResolvedValueOnce(Response.json({...raw('LOCAL-OLD'),transaction_status:'settlement',status_code:'200'}));
        vi.stubGlobal('fetch',http);
        await expect(new InvoiceMidtransClient().createPayment(invoice,payment,'LOCAL-1')).rejects.toThrow('belum selesai');
        expect(m.browser).not.toHaveBeenCalled();expect(http).toHaveBeenCalledTimes(3);
    });
    it('uses the signed-webhook BSI ID and SNAP_API source for status, caching the real provider ID',async()=>{
        const p=buildInvoicePaymentBreakdown('bsi_va',100000)!;
        m.browser.mockResolvedValue({...raw(),transaction_status:undefined,transaction_id:'snap-placeholder-bsi',bsi_va_number:'20201234567890123',va_numbers:undefined});
        m.bsiId.mockResolvedValue('A320261113VerifiedBsiID');
        const http=vi.fn(async(url:string,init:RequestInit)=>{
            if(url.endsWith('/snap/v1/transactions'))return Response.json({token:'local-snap-token'});
            expect(url).toContain('/A320261113VerifiedBsiID/status');
            expect(init.headers).toMatchObject({'transaction-source':'SNAP_API'});
            return Response.json({...raw(),va_numbers:undefined,transaction_id:'A320261113VerifiedBsiID'});
        });vi.stubGlobal('fetch',http);
        const first=await new InvoiceMidtransClient().createPayment(invoice,p,'LOCAL-1');
        expect(first.transactionId).toBe('A320261113VerifiedBsiID');
        expect((await new InvoiceMidtransClient().createPayment(invoice,p,'LOCAL-2')).orderId).toBe('LOCAL-1');
        expect(m.bsiId).toHaveBeenCalledTimes(1);expect(m.browser).toHaveBeenCalledTimes(1);
    });
    it('keeps the same BSI token when its verified webhook has not arrived yet',async()=>{
        const p=buildInvoicePaymentBreakdown('bsi_va',100000)!;
        vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.endsWith('/snap/v1/transactions')?{token:'local-snap-token'}:{...raw(),va_numbers:undefined,transaction_id:'A320261113VerifiedBsiID'})));
        m.browser.mockResolvedValue({...raw(),bsi_va_number:'20201234567890123',va_numbers:undefined});
        m.bsiId.mockRejectedValueOnce(new Error('Konfirmasi belum diterima')).mockResolvedValueOnce('A320261113VerifiedBsiID');
        await expect(new InvoiceMidtransClient().createPayment(invoice,p,'LOCAL-1')).rejects.toThrow('Konfirmasi');
        expect((await new InvoiceMidtransClient().createPayment(invoice,p,'LOCAL-2')).orderId).toBe('LOCAL-1');
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe('validated customer instructions',()=>{
    it.each(['bni','bri','cimb','bsi','permata'])('checks the actual %s bank and rejects a mislabelled VA',bank=>{
        const method=`${bank}_va` as 'bni_va';const p=buildInvoicePaymentBreakdown(method,100000)!;
        expect(normalizeSnapPayment({...raw(),va_numbers:[{bank,va_number:'123456789012'}]},p,'LOCAL-1').paymentDetails.bank).toBe(bank);
        expect(()=>normalizeSnapPayment({...raw(),va_numbers:[{bank:'wrong-bank',va_number:'123456789012'}]},p,'LOCAL-1')).toThrow('rekening');
    });
    it('requires both Mandiri codes and preserves its exact fee-inclusive amount',()=>{
        const p=buildInvoicePaymentBreakdown('mandiri_bill',100000)!;
        expect(normalizeSnapPayment({...raw(),payment_type:'echannel',biller_code:'12345',bill_key:'1234567890'},p,'LOCAL-1').paymentDetails).toMatchObject({billerCode:'12345',billKey:'1234567890',total:102500});
        expect(()=>normalizeSnapPayment({...raw(),payment_type:'echannel',biller_code:'12345'},p,'LOCAL-1')).toThrow('Kode');
    });
    it('validates the original QR checksum and amount then renders a real PNG without a network request',async()=>{
        const p=buildInvoicePaymentBreakdown('qris',100000)!;
        const result=normalizeSnapPayment({...raw(),payment_type:'qris',qr_string:testQr(p.total)},p,'LOCAL-1');
        const http=vi.fn();vi.stubGlobal('fetch',http);
        const png=await renderInvoicePaymentQr(result.paymentDetails);
        expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(http).not.toHaveBeenCalled();
        expect(validQrPayload(testQr(1),p.total)).toBe(false);
        expect(validQrPayload(testQr(p.total).slice(0,-1)+(testQr(p.total).endsWith('0')?'1':'0'),p.total)).toBe(false);
        expect(()=>normalizeSnapPayment({...raw(),payment_type:'qris',qr_string:testQr(1)},p,'LOCAL-1')).toThrow('QR');
    });
    it('never creates a QR from a checkout/deeplink URL or leaks credentials to a redirected image',async()=>{
        vi.stubGlobal('fetch',vi.fn());
        await expect(renderInvoicePaymentQr({deeplinkUrl:'https://app.midtrans.com/snap/checkout'})).rejects.toThrow('belum tersedia');
        for(const qrCodeUrl of ['http://api.midtrans.com/qr','https://api.midtrans.com.evil.example/qr','https://127.0.0.1/qr','https://api.midtrans.com:444/qr'])await expect(renderInvoicePaymentQr({qrCodeUrl})).rejects.toThrow('Sumber');
        expect(fetch).not.toHaveBeenCalled();
    });
});
