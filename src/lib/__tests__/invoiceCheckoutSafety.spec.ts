import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ from:vi.fn(),rpc:vi.fn(),history:vi.fn(),snapshot:vi.fn() }));
vi.mock('@/lib/supabaseServer',()=>({getSupabaseAdmin:()=>({from:mock.from,rpc:mock.rpc})}));
vi.mock('@/lib/invoicePaymentStore',()=>({getHistoricalInvoicePayments:mock.history,updateStoredInvoicePaymentStatus:mock.snapshot}));
vi.mock('@/lib/dao/invoicesDao',()=>({getInvoiceById:vi.fn(),getInvoiceSettings:vi.fn()}));
import { CheckoutError, assertProviderAmount, checkoutToken, verifyCheckoutToken, createCheckoutPayment, refreshCheckoutIntent, type CheckoutIntent, type CheckoutLink } from '@/lib/services/invoiceCheckoutServer';
import type { Invoice } from '@/lib/types/invoice';

const invoice: Invoice={id:'00000000-0000-4000-8000-000000000001',invoice_number:'QA-1',ccr_id:'family-1',parent_name:'QA',parent_phone:'628123456789',period_month:10,period_year:2026,period_start_date:'2026-10-26',period_end_date:'2026-11-25',total_amount:500000,status:'PENDING',invoice_type:'MONTHLY',due_date:'2026-10-25',paid_at:null,paid_notes:null,created_at:'',updated_at:'',items:[]};
const link:CheckoutLink={id:'00000000-0000-4000-8000-000000000002',invoice_ids:[invoice.id],ccr_id:'family-1',parent_phone:invoice.parent_phone,send_state:'DRAFT',sent_at:null};
let current:CheckoutIntent|null, claims:Array<{order_id:string}>,sequence:string[];
const pending=(order='LMSB-existing'):CheckoutIntent=>({order_id:order,link_id:link.id,state:'PENDING',method:'qris',base_amount:500000,admin_fee:2500,total_amount:502500,payment_details:null});
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv('NEXTAUTH_SECRET','local-checkout-test-secret');vi.stubEnv('MIDTRANS_SERVER_KEY','SB-Mid-server-local-test');vi.stubEnv('MIDTRANS_IS_PRODUCTION','false');vi.stubEnv('NEXTAUTH_URL','http://localhost:3005');vi.stubEnv('LMS_SELECTED_INVOICE_CHECKOUT_ENABLED','true');
  current=null;claims=[];sequence=[];mock.history.mockResolvedValue([]);mock.snapshot.mockResolvedValue(null);
  mock.from.mockImplementation((table:string)=>{
    let filters:Record<string,unknown>={}, patch:Record<string,unknown>|undefined;
    const q:any={ select:()=>q, in:()=>q, eq:(key:string,value:unknown)=>{filters[key]=value;return q;}, update:(value:Record<string,unknown>)=>{patch=value;return q;},
      maybeSingle:async()=>({data:current,error:null}),
      then:(resolve:(value:unknown)=>unknown)=>{
        if(table==='invoice_checkout_intents'&&patch){sequence.push('attach');if(current?.state===filters.state)current={...current,...patch} as CheckoutIntent;}
        const value=table==='invoice_checkout_claims'?{data:claims,error:null}:table==='invoice_checkout_allocations'?{data:[{invoice_id:invoice.id}],error:null}:table==='invoice_payment_attempts'?{data:null,error:{code:'PGRST205'}}:{data:current,error:null};
        return Promise.resolve(resolve(value));
      }};return q;
  });
  mock.rpc.mockImplementation(async(name:string,input:Record<string,unknown>)=>{
    sequence.push(name);
    if(name==='reserve_invoice_checkout'){current={...pending(String(input.p_order)),state:'CREATING'};claims=[{order_id:current.order_id}];}
    return {data:name==='finish_invoice_checkout'?{state:input.p_outcome,duplicate:false}:null,error:null};
  });
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});

describe('payment safety ordering with real gateway client and mocked HTTP only',()=>{
  it('commits reservation before Snap/charge and attaches instructions only after exact amount validation',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
      expect(url.startsWith('https://app.sandbox.midtrans.com/')).toBe(true);
      const body=JSON.parse(String(init.body));
      if(url.endsWith('/snap/v1/transactions')){sequence.push('snap');expect(claims).toHaveLength(1);expect(body.transaction_details.gross_amount).toBe(502500);return Response.json({token:'qa-snap'});}
      sequence.push('charge');return Response.json({status_code:'201',transaction_status:'pending',order_id:current!.order_id,gross_amount:'502500.00',actions:[{name:'generate-qr-code',url:'https://api.sandbox.midtrans.com/qa/qr'}]});
    }));
    const result=await createCheckoutPayment([invoice],link.id,'qris',500000);
    expect(sequence).toEqual(['reserve_invoice_checkout','snap','charge','attach']);expect(result.state).toBe('PENDING');
  });
  it('retains the claim on a network timeout; retry does not create a second charge',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>{sequence.push('snap-timeout');throw new Error('network timeout');}));
    await expect(createCheckoutPayment([invoice],link.id,'qris',500000)).rejects.toThrow('rekonsiliasi');
    expect(claims).toHaveLength(1);expect(current!.state).toBe('CREATING');
    const retry=await createCheckoutPayment([invoice],link.id,'qris',500000);
    expect(retry.state).toBe('CREATING');expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('fails closed on a database race before any gateway call',async()=>{
    vi.stubGlobal('fetch',vi.fn());mock.rpc.mockResolvedValue({data:null,error:{code:'P0001'}});
    await expect(createCheckoutPayment([invoice],link.id,'qris',500000)).rejects.toBeInstanceOf(CheckoutError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ['CHECKOUT_PERIOD_REVIEW_REQUIRED','Data periode tagihan belum lengkap',409],
    ['CHECKOUT_PERIOD_OVERLAP','Periode tagihan beririsan',409],
    ['CHECKOUT_ALREADY_RESERVED','Sudah ada instruksi pembayaran aktif',409],
    ['CHECKOUT_AMOUNT_CHANGED','Rincian nominal tagihan sudah diperbarui',409],
    ['CHECKOUT_STATUS_CHANGED','Status tagihan sudah berubah',409],
    ['private database detail','Layanan pembayaran belum dapat memproses permintaan',503],
  ])('explains %s accurately without charging or exposing raw database detail',async(message,expected,status)=>{
    vi.stubGlobal('fetch',vi.fn());
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    mock.rpc.mockResolvedValue({data:null,error:{code:'P0001',message}});
    try {
      await expect(createCheckoutPayment([invoice],link.id,'qris',500000)).rejects.toMatchObject({message:expect.stringContaining(expected),status});
      expect(fetch).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('[InvoiceCheckout] Database operation failed',{operation:'reserve_invoice_checkout',code:'P0001',reason:message.startsWith('CHECKOUT_')?message:'UNEXPECTED_DATABASE_ERROR'});
    } finally {log.mockRestore();}
  });
  it('refuses stale totals, disabled GoPay and mixed-family selections before reserve/charge',async()=>{
    vi.stubGlobal('fetch',vi.fn());
    await expect(createCheckoutPayment([invoice],link.id,'qris',1)).rejects.toThrow('Total tagihan berubah');
    await expect(createCheckoutPayment([invoice],link.id,'gopay',500000)).rejects.toThrow('tidak tersedia');
    await expect(createCheckoutPayment([invoice,{...invoice,id:'other',ccr_id:'other-family',period_month:9}],link.id,'qris',1000000)).rejects.toThrow('keluarga');
    expect(mock.rpc).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  });
  it('does not assume that a previous QR/VA became unpayable just because it is old locally',async()=>{
    mock.history.mockResolvedValue([{invoiceId:invoice.id,orderId:'LMS-older',total:502500,expiresAt:'2020-01-01',transactionStatus:'pending'}]);
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({order_id:'LMS-older',gross_amount:'502500.00',transaction_status:'pending',status_code:'201'})));
    await expect(createCheckoutPayment([invoice],link.id,'qris',500000)).rejects.toThrow('instruksi pembayaran lama');
    expect(mock.rpc).not.toHaveBeenCalled();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not attach wrong gateway totals; the reservation remains held for reconciliation',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>Response.json(url.endsWith('/snap/v1/transactions')?{token:'qa'}:{order_id:current!.order_id,gross_amount:'1.00',status_code:'201',transaction_status:'pending'})));
    await expect(createCheckoutPayment([invoice],link.id,'qris',500000)).rejects.toThrow('rekonsiliasi');
    expect(sequence).toEqual(['reserve_invoice_checkout']);expect(current!.state).toBe('CREATING');
  });
  it('treats settlement winning the cancel race as paid, never as released/cancelled',async()=>{
    const intent=pending();let calls=0;
    vi.stubGlobal('fetch',vi.fn(async()=>{calls++;return Response.json({order_id:intent.order_id,gross_amount:'502500.00',status_code:calls===1?'201':'200',transaction_status:calls===1?'pending':calls===2?'cancel':'settlement',settlement_time:'2026-10-21T10:00:00+07:00'});}));
    expect((await refreshCheckoutIntent(intent,true)).state).toBe('PAID');
    expect(mock.rpc).toHaveBeenCalledWith('finish_invoice_checkout',expect.objectContaining({p_outcome:'PAID',p_total:502500}));
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('does not release on 404, failed cancel, or unknown provider status',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({status_code:'404'},{status:404})));
    await expect(refreshCheckoutIntent(pending(),true)).rejects.toThrow('belum dapat dipastikan');expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('feature-off blocks new charges but does not disable final status reconciliation',async()=>{
    vi.stubEnv('LMS_SELECTED_INVOICE_CHECKOUT_ENABLED','false');vi.stubGlobal('fetch',vi.fn(async()=>Response.json({order_id:'LMSB-existing',gross_amount:'502500.00',status_code:'200',transaction_status:'settlement'})));
    await expect(createCheckoutPayment([invoice],link.id,'qris',500000)).rejects.toThrow('belum diaktifkan');
    expect((await refreshCheckoutIntent(pending())).state).toBe('PAID');
  });
});

describe('capability scope and exact amount',()=>{
  it('binds a link to its immutable scope, family and phone; rejects tampering',()=>{
    const token=checkoutToken(link);expect(verifyCheckoutToken(link,token)).toBe(true);
    expect(verifyCheckoutToken({...link,invoice_ids:['foreign']},token)).toBe(false);
    expect(verifyCheckoutToken({...link,ccr_id:'foreign'},token)).toBe(false);
    expect(verifyCheckoutToken(link,'invalid')).toBe(false);
  });
  it('rejects fractional, zero, unrelated or spoofed amounts',()=>{
    for(const gross of ['502500.01','0','NaN','5.025e5','-502500'])expect(()=>assertProviderAmount(pending(),{order_id:'LMSB-existing',gross_amount:gross})).toThrow();
    expect(()=>assertProviderAmount(pending(),{order_id:'other',gross_amount:'502500.00'})).toThrow();
    expect(()=>assertProviderAmount(pending(),{order_id:'LMSB-existing',gross_amount:'502500.00'})).not.toThrow();
  });
});
