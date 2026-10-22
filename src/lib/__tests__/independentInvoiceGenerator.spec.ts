import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mock=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),settings:vi.fn(),ccr:vi.fn(),invoice:vi.fn()}));
vi.mock('@/lib/supabaseServer',()=>({getSupabaseAdmin:()=>({from:mock.from,rpc:mock.rpc})}));
vi.mock('@/lib/dao/invoicesDao',()=>({getInvoiceSettings:mock.settings,getOrCreateCCR:mock.ccr,getInvoiceById:mock.invoice,formatInvoiceNumber:(c:string,m:number,y:number)=>`${c}-${m}${y}`}));
import { generateIndependentInvoicesForMonth } from '@/lib/services/independentInvoiceGenerator';

let anchor:any,enrollment:any,events:any[],pauses:any[];
beforeEach(()=>{
  vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-21T06:00:00Z'));
  anchor={id:'period-1',coder_id:'coder-1',class_id:'class-1',start_date:'2026-08-26',end_date:'2026-09-25',status:'EXPIRED',created_at:'2026-08-01',total_amount:500000,
    users:{full_name:'QA Coder',parent_name:'QA Parent',parent_contact_phone:'628123456789',is_active:true,updated_at:'2026-01-01'},classes:{id:'class-1',name:'QA Class',type:'WEEKLY',lifecycle_status:'ACTIVE',archived_at:null,start_date:'2026-01-01',end_date:'2027-12-31',levels:{name:'QA Level'}},payment_plans:{duration_months:1,discount_percent:0},pricing:{base_price_monthly:500000}};
  enrollment={coder_id:'coder-1',class_id:'class-1',enrolled_at:'2026-01-01',updated_at:'2026-01-01',status:'ACTIVE'};events=[];pauses=[];
  mock.from.mockImplementation((table:string)=>{
    const q:any={select:()=>q,not:()=>q,order:()=>q,in:()=>q,eq:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(resolve({data:table==='coder_payment_periods'?[anchor]:table==='enrollments'?[enrollment]:table==='class_lifecycle_changes'?pauses:events,error:null}))};return q;
  });
  mock.settings.mockResolvedValue({generate_day:15,due_days:10});mock.ccr.mockResolvedValue({id:'ccr-1',ccr_code:'CCR001',parent_name:'QA Parent'});
  mock.rpc.mockResolvedValue({data:{id:'new-invoice',created:true},error:null});mock.invoice.mockResolvedValue({id:'new-invoice',status:'PENDING'});
});
afterEach(()=>vi.useRealTimers());
describe('actual generator effects with mocked database boundary',()=>{
  it('generates the current obligation despite an EXPIRED/unpaid prior period, without modifying access',async()=>{
    const result=await generateIndependentInvoicesForMonth(10,2026);expect(result.generated).toBe(1);
    expect(mock.rpc).toHaveBeenCalledWith('upsert_invoice_billing_cycle',expect.objectContaining({p_invoice:expect.objectContaining({period_month:10,period_start_date:'2026-10-26',period_end_date:'2026-11-25'}),p_items:[expect.objectContaining({payment_period_id:'period-1',final_price:500000,billing_duration_months:1})]}));
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it('does not create obligations for inactive coders, inactive enrollment, stopped plans or Ekskul',async()=>{
    anchor.users.is_active=false;expect((await generateIndependentInvoicesForMonth(10,2026)).generated).toBe(0);
    anchor.users.is_active=true;enrollment.class_id='other';expect((await generateIndependentInvoicesForMonth(10,2026)).generated).toBe(0);
    enrollment.class_id='class-1';anchor.status='STOPPED';expect((await generateIndependentInvoicesForMonth(10,2026)).generated).toBe(0);
    anchor.status='EXPIRED';anchor.classes.type='EKSKUL';expect((await generateIndependentInvoicesForMonth(10,2026)).generated).toBe(0);expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('never chases a month before a recorded reactivation, and does not extend/shift unused lessons',async()=>{
    events=[{coder_id:'coder-1',class_id:null,active:true,changed_at:'2026-10-01T00:00:00Z'}];
    expect((await generateIndependentInvoicesForMonth(9,2026)).generated).toBe(0);
    expect((await generateIndependentInvoicesForMonth(10,2026)).generated).toBe(1);
    expect(anchor.end_date).toBe('2026-09-25');
  });
  it('uses a conservative updated_at boundary if the historic inactive interval is unknown',async()=>{
    anchor.users.updated_at='2026-10-01';
    const result=await generateIndependentInvoicesForMonth(9,2026);expect(result.generated).toBe(0);expect(result.errors.length).toBe(1);expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('skips a class with an unreviewed pause and does not infer missed-month debt',async()=>{
    pauses=[{class_id:'class-1',new_status:'PAUSED',previous_status:'ACTIVE',created_at:'2026-10-01'}];
    expect((await generateIndependentInvoicesForMonth(10,2026)).generated).toBe(0);expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('keeps three-month charges/ranges and does not bill the intervening months',async()=>{
    anchor.payment_plans={duration_months:3,discount_percent:10};
    expect((await generateIndependentInvoicesForMonth(10,2026)).generated).toBe(0);
    expect((await generateIndependentInvoicesForMonth(9,2026)).generated).toBe(1);
    expect(mock.rpc).toHaveBeenCalledWith('upsert_invoice_billing_cycle',expect.objectContaining({p_items:[expect.objectContaining({base_price:1500000,discount_amount:150000,final_price:1350000,billing_end_date:'2026-12-25',billing_duration_months:3})]}));
  });
  it('reports an existing immutable invoice as skipped instead of modifying or claiming another generation',async()=>{
    mock.rpc.mockResolvedValue({data:{id:'existing',created:false},error:null});
    const result=await generateIndependentInvoicesForMonth(10,2026);expect(result.generated).toBe(0);expect(result.skipped).toBe(1);expect(mock.invoice).not.toHaveBeenCalled();
  });
});
