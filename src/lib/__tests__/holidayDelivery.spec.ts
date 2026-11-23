import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),send:vi.fn(),invoice:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabaseServer',()=>({getSupabaseAdmin:()=>({rpc:mocks.rpc,from:mocks.from})}));
vi.mock('@/lib/dao/invoicesDao',()=>({getInvoiceById:mocks.invoice}));
vi.mock('@/lib/services/whatsappClient',()=>({sendWhatsAppMessage:mocks.send}));
vi.mock('@/lib/services/holidayClassPayment',()=>({holidayInvoiceUrl:()=> 'https://example.test/invoice/QA'}));
vi.mock('@/lib/services/trialClassNotifications',()=>({trialAdminWhatsAppGroup:()=> 'qa-group'}));
import { deliverHolidayWhatsApp } from '@/lib/services/holidayClassMessaging';
import { deliverHolidayConversions } from '@/lib/services/holidayMetaConversions';

let saved:Record<string,unknown>[];
beforeEach(()=>{
  vi.clearAllMocks();saved=[];
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-23T03:00:00Z'));
  mocks.rpc.mockResolvedValue({data:[{id:1,registration_id:'qa',kind:'invoice_parent',attempts:1,claimed_at:'lease'}],error:null});
  mocks.invoice.mockResolvedValue({invoice_number:'HC-2627-999991',total_amount:350000,parent_phone:'6281234567890',status:'PENDING',due_date:'2026-11-25'});
  mocks.from.mockImplementation(()=>{
    const chain={select:()=>chain,eq:()=>chain,single:async()=>({data:{invoice_id:'invoice',platform:'none',selections:[],attribution:{measurement:true},invoices:{parent_phone:'6281234567890'}},error:null}),
      update:(value:Record<string,unknown>)=>{saved.push(value);return chain;},then:(resolve:(r:unknown)=>unknown)=>Promise.resolve({error:null}).then(resolve)};
    return chain;
  });
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('Holiday delivery without external side effects',()=>{
  it('records a useful redacted WhatsApp error and retains the existing retry policy',async()=>{
    mocks.send.mockResolvedValue({success:false,error:'WhatsApp not connected for 6281234567890'});
    await deliverHolidayWhatsApp();
    expect(saved[0]).toMatchObject({claimed_at:null,sent_at:null,failed_at:null,last_error:'WhatsApp not connected for [number]'});
    expect(saved[0].next_attempt_at).toBe('2026-11-23T03:02:00.000Z');
  });
  it('stops a claimed reminder after payment instead of sending a stale nudge',async()=>{
    vi.stubEnv('HOLIDAY_REMINDER_ENABLED','true');
    mocks.rpc.mockResolvedValue({data:[{id:1,registration_id:'qa',kind:'reminder_1',attempts:1,claimed_at:'lease'}],error:null});
    mocks.invoice.mockResolvedValue({status:'PAID',paid_at:'2026-11-23',due_date:'2026-11-25'});
    vi.spyOn(console,'warn').mockImplementation(()=>undefined);
    await deliverHolidayWhatsApp();
    expect(mocks.send).not.toHaveBeenCalled();expect(saved[0].failed_at).toBeTruthy();
  });
  it('does not send or consume retries when reminders are disabled',async()=>{
    vi.stubEnv('HOLIDAY_REMINDER_ENABLED','false');
    mocks.rpc.mockResolvedValue({data:[{id:1,registration_id:'qa',kind:'reminder_1',attempts:2,claimed_at:'lease'}],error:null});
    await deliverHolidayWhatsApp();
    expect(mocks.send).not.toHaveBeenCalled();expect(saved[0]).toMatchObject({claimed_at:null,attempts:1});
  });
  it('does not claim Meta events without configuration',async()=>{
    vi.stubEnv('META_CONVERSIONS_API_TOKEN','');vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID','');
    vi.spyOn(console,'warn').mockImplementation(()=>undefined);
    expect(await deliverHolidayConversions()).toEqual({sent:0,skipped:true});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('keeps failed Meta events for retry, sends the test code and never logs the token',async()=>{
    vi.stubEnv('META_CONVERSIONS_API_TOKEN','qa-token');vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID','123');vi.stubEnv('META_TEST_EVENT_CODE','TEST-QA');
    mocks.rpc.mockResolvedValue({data:[{id:1,registration_id:'qa',event_name:'Purchase',event_id:'HC-QA',event_time:'2026-11-23T03:00:00Z',value:352500,attempts:1,claimed_at:'lease'}],error:null});
    const fetch=vi.fn().mockResolvedValue({ok:false,status:429,json:async()=>({error:{code:4,message:'untrusted diagnostic'}})});vi.stubGlobal('fetch',fetch);
    expect(await deliverHolidayConversions()).toMatchObject({sent:0});
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({test_event_code:'TEST-QA',data:[{event_id:'HC-QA'}]});
    expect(saved[0]).toMatchObject({sent_at:null,claimed_at:null,last_error:'Meta HTTP 429; code 4'});
    expect(JSON.stringify(saved)).not.toContain('qa-token');
  });
});
