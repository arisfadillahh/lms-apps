import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPeriod, type PeriodRecord, type PayrollMeeting } from '@/lib/payroll/model';
import { payrollCommandSchema } from '@/lib/payroll/validation';
import { canonicalMeetingCandidates } from '@/lib/payroll/attendanceDetails';
vi.mock('server-only', () => ({}));
const mocks=vi.hoisted(()=>({get:vi.fn(),config:vi.fn(),commit:vi.fn(),candidates:vi.fn()}));
vi.mock('@/lib/dao/payrollDao',()=>({getPayrollPeriod:mocks.get,getPayrollConfig:mocks.config,commitPayrollPeriod:mocks.commit}));
vi.mock('@/lib/supabaseServer',()=>({getSupabaseAdmin:()=>({})}));
vi.mock('@/lib/services/payroll',()=>({payrollMeetingCandidates:mocks.candidates,requireDraft:(r:PeriodRecord)=>{if(r.document.status!=='DRAFT')throw new Error('Buka revisi');},requireReason:()=>{},assertComponentDate:()=>{}}));
vi.mock('@/lib/services/payrollNotifications',()=>({attendanceAdmins:vi.fn()}));
vi.mock('@/lib/dao/notificationsDao',()=>({createNotification:vi.fn()}));
import { executePayrollCommand } from '@/lib/services/payrollCommands';
const profile='20000000-0000-4000-8000-000000000001';
const user='30000000-0000-4000-8000-000000000001';
const key='summary:source:Fee Online 1';
const base={action:'override' as const,periodId:'2026-11',revision:3,sourceKey:key,profileId:profile,reason:'Verified actual meetings'};
describe('server-side meeting correction validation',()=>{
  let record:PeriodRecord;let meetings:PayrollMeeting[];
  beforeEach(()=>{
    vi.clearAllMocks();
    record={id:'2026-11',revision:3,document:createPeriod(2026,11)};
    record.document.slips=[{profile_id:profile,user_id:user,kind:'COACH',contract:'MITRA',name:'Demo Coach',job_title:'Coach',total:140000,lines:[{key,date:'',label:'Kelas online · 1 anak',kind:'CLASS_SUMMARY',quantity:2,rate:70000,amount:140000,details:'',summary:true}]}];
    meetings=['a','b'].map((id,i)=>({key:`session:${id}`,date:`2026-11-0${i+1}T08:00:00Z`,label:'Robotics',user_id:user,kind:'WEEKLY',delivery:'ONLINE',students:1,cancelled:false}));
    mocks.get.mockImplementation(async()=>structuredClone(record));mocks.config.mockResolvedValue({people:[{id:profile,user_id:user,active:true}]});mocks.candidates.mockImplementation(async()=>structuredClone(meetings));mocks.commit.mockImplementation(async(_r,document)=>({...record,document}));
  });
  it('derives quantity from verified selected keys and stores an audit-ready override',async()=>{
    const saved=await executePayrollCommand({...base,quantity:999,meetingKeys:['session:b']},'admin',new Date('2026-11-05T00:00:00Z')) as PeriodRecord;
    expect(saved.document.overrides[key]).toMatchObject({quantity:1,meeting_keys:['session:b'],reason:base.reason});expect(saved.document.calculated_at).toBeNull();expect(mocks.commit).toHaveBeenCalledWith(expect.anything(),expect.anything(),'admin','OVERRIDE',base.reason);
  });
  it.each(['duplicate','owner','cancelled','delivery','size','used','excluded','missing'])('rejects invalid %s selection without saving',async scenario=>{
    let keys=['session:a'];
    if(scenario==='duplicate')keys=['session:a','session:a'];
    if(scenario==='owner')meetings[0].user_id='other';
    if(scenario==='cancelled')meetings[0].cancelled=true;
    if(scenario==='delivery')meetings[0].delivery='OFFLINE';
    if(scenario==='size')meetings[0].students=2;
    if(scenario==='used')record.document.overrides.other={meeting_keys:keys,reason:'Other category'};
    if(scenario==='excluded')record.document.overrides['session:a']={excluded:true,reason:'Cancelled by admin'};
    if(scenario==='missing')keys=['session:unknown'];
    await expect(executePayrollCommand({...base,meetingKeys:keys},'admin')).rejects.toThrow();expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('allows count-only correction including zero but rejects count edits of a single meeting',async()=>{
    await executePayrollCommand({...base,quantity:0},'admin');expect(mocks.candidates).not.toHaveBeenCalled();
    record.document.slips[0].lines[0].summary=false;
    await expect(executePayrollCommand({...base,quantity:2},'admin')).rejects.toThrow(/pertemuan tunggal/);
  });
  it('requires a current revision and a draft period',async()=>{
    await expect(executePayrollCommand({...base,revision:2,quantity:1},'admin')).rejects.toThrow(/berubah/);
    record.document.status='FINAL';await expect(executePayrollCommand({...base,quantity:1},'admin')).rejects.toThrow(/revisi/);expect(mocks.commit).not.toHaveBeenCalled();
  });
  it.each([-1,1.5,10001,NaN])('schema rejects invalid quantity %s',quantity=>expect(payrollCommandSchema.safeParse({...base,quantity}).success).toBe(false));
  it('does not offer the same physical class twice through source and LMS identities',()=>{
    const source={...meetings[0],key:'source:actual',label:' Robotics  ',origin:'SOURCE' as const};
    const candidates=canonicalMeetingCandidates([...meetings,source]);expect(candidates.map(m=>m.key)).toEqual(['source:actual','session:b']);
    expect(canonicalMeetingCandidates([source,...meetings]).map(m=>m.key)).toEqual(['source:actual','session:b']);
  });
});
