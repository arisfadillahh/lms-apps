import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({session:vi.fn(),authorize:vi.fn(),create:vi.fn(),intent:vi.fn(),members:vi.fn(),refresh:vi.fn(),data:vi.fn(),link:vi.fn(),preview:vi.fn(),send:vi.fn()}));
vi.mock('next-auth',()=>({getServerSession:m.session}));
vi.mock('@/lib/authOptions',()=>({authOptions:{}}));
vi.mock('@/lib/dao/invoicesDao',()=>({getInvoiceById:vi.fn(),INVOICE_ITEMS_WITH_BILLING_DURATION:'items(*)'}));
vi.mock('@/lib/services/invoiceCheckoutMessaging',()=>({sendCheckoutMessage:m.send,sendCheckoutPaidConfirmation:vi.fn()}));
vi.mock('@/lib/services/invoiceCheckoutServer',()=>({
  CheckoutError:class extends Error{constructor(message:string,public status=409){super(message);}},authorizeCheckout:m.authorize,publicCheckoutData:m.data,createCheckoutPayment:m.create,getCheckoutIntent:m.intent,intentInvoiceIds:m.members,refreshCheckoutIntent:m.refresh,
  requireInvoiceCheckoutEnabled:()=>{},getCheckoutLink:m.link,checkoutPreview:m.preview,createCheckoutLink:m.link,
}));
import { CheckoutError } from '@/lib/services/invoiceCheckoutServer';
import { POST,GET } from '@/app/api/invoice-checkouts/[id]/route';
import { POST as adminCreate } from '@/app/api/admin/invoice-checkouts/route';
import { POST as adminSend } from '@/app/api/admin/invoice-checkouts/[id]/send/route';
const invoiceId='00000000-0000-4000-8000-000000000001',linkId='00000000-0000-4000-8000-000000000002';
const params={params:Promise.resolve({id:linkId})};
const request=(body:unknown)=>new NextRequest('http://localhost/api/invoice-checkouts/'+linkId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{
  vi.resetAllMocks();vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Live HTTP forbidden in route test');}));
  m.authorize.mockResolvedValue({link:{id:linkId,invoice_ids:[invoiceId]},invoices:[{id:invoiceId,total_amount:500000,status:'PENDING',invoice_type:'MONTHLY'}]});m.data.mockResolvedValue({invoices:[],active:[],enabled:true});
});
afterEach(()=>vi.unstubAllGlobals());
describe('checkout route authorization and stale state',()=>{
  it('rejects a bad capability before creating payment or exposing invoice data',async()=>{
    m.authorize.mockRejectedValue(new CheckoutError('Link pembayaran tidak valid.',404));
    const r=await POST(request({action:'pay',token:'wrong',invoiceIds:[invoiceId],method:'qris',expectedBase:500000}),params);
    expect(r.status).toBe(404);expect(m.create).not.toHaveBeenCalled();expect(m.data).not.toHaveBeenCalled();
  });
  it('rechecks a parent supplied total before any charge',async()=>{
    const r=await POST(request({action:'pay',token:'local-test',invoiceIds:[invoiceId],method:'qris',expectedBase:1}),params);
    expect(r.status).toBe(409);expect(m.create).not.toHaveBeenCalled();
  });
  it('rejects a paid/unknown selected invoice rather than reallocating the payment to another month',async()=>{
    const r=await POST(request({action:'pay',token:'local-test',invoiceIds:[linkId],method:'qris',expectedBase:500000}),params);
    expect(r.status).toBe(409);expect(m.create).not.toHaveBeenCalled();
  });
  it('only creates the selected invoice subset and reloads the current status afterwards',async()=>{
    const r=await POST(request({action:'pay',token:'local-test',invoiceIds:[invoiceId],method:'qris',expectedBase:500000}),params);
    expect(r.status).toBe(200);expect(m.create).toHaveBeenCalledWith([expect.objectContaining({id:invoiceId})],linkId,'qris',500000);expect(m.authorize).toHaveBeenCalledTimes(2);
  });
  it('does not let a valid link cancel a transaction from another link',async()=>{
    m.intent.mockResolvedValue({order_id:'LMSB-other',link_id:'foreign'});
    const r=await POST(request({action:'cancel',token:'local-test',orderId:'LMSB-other'}),params);
    expect(r.status).toBe(404);expect(m.refresh).not.toHaveBeenCalled();
  });
  it('returns a no-store public read without mutating payment state',async()=>{
    const r=await GET(new NextRequest('http://localhost/api/invoice-checkouts/'+linkId+'?t=local-test'),params);
    expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');expect(m.create).not.toHaveBeenCalled();expect(m.refresh).not.toHaveBeenCalled();
  });
  it('requires Admin for creation and sending, even if public pages are reachable',async()=>{
    m.session.mockResolvedValue({user:{role:'CODER'}});
    expect((await adminCreate(request({invoiceIds:[invoiceId]}))).status).toBe(401);
    expect((await adminSend(request({previewHash:'a'.repeat(64)}),params)).status).toBe(401);
    expect(m.link).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();
  });
  it('does not send automatically when an admin creates/previews a link',async()=>{
    m.session.mockResolvedValue({user:{id:'admin-id',role:'ADMIN'}});m.link.mockResolvedValue({id:linkId});m.preview.mockResolvedValue({message:'local preview',previewHash:'a'.repeat(64)});
    expect((await adminCreate(request({invoiceIds:[invoiceId]}))).status).toBe(200);expect(m.send).not.toHaveBeenCalled();
  });
  it('requires a preview hash before sending',async()=>{
    m.session.mockResolvedValue({user:{id:'admin-id',role:'ADMIN'}});
    expect((await adminSend(request({}),params)).status).toBe(400);expect(m.send).not.toHaveBeenCalled();
  });
});
