import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabaseServer',()=>({getSupabaseAdmin:vi.fn()}));
import { holidayEventId } from '@/lib/holidayAttribution';
import { buildHolidayMetaEvent } from '@/lib/services/holidayMetaConversions';
import { holidayReminderAllowed,holidayReminderStage } from '@/lib/holidayReminders';
import { buildContentSecurityPolicy } from '@/lib/security/contentSecurityPolicy';
describe('Holiday measurement and reminder rules',()=>{
  it('uses identical stable IDs for browser/server and payment replay',()=>{
    expect(holidayEventId('CompleteRegistration','reg','HC-2627-1')).toBe('reg');
    expect(holidayEventId('InitiateCheckout','reg','HC-2627-1')).toBe('checkout:HC-2627-1');
    expect(holidayEventId('Purchase','reg','HC-2627-1')).toBe('HC-2627-1');
  });
  it('hashes normalized phone and includes browser matching fields without raw phone',()=>{
    const e={event_name:'Purchase' as const,event_id:'HC-2627-1',event_time:'2026-11-23T09:00:00Z',value:352500};
    const a=buildHolidayMetaEvent(e,'081234567890',{fbp:'fb.1.2.3',fbc:'fb.1.2.click',client_user_agent:'UA',client_ip_address:'192.0.2.1'});
    expect(a.user_data.ph).toEqual(buildHolidayMetaEvent(e,'6281234567890').user_data.ph);
    expect(JSON.stringify(a)).not.toContain('081234567890');
    expect(a.custom_data).toEqual({value:352500,currency:'IDR'});
    expect(a.user_data).toMatchObject({fbp:'fb.1.2.3',fbc:'fb.1.2.click',client_user_agent:'UA'});
  });
  it('uses H+1/H+3 elapsed days and only sends 09.00–19.59 WIB to valid unpaid invoices',()=>{
    const created='2026-11-20T02:00:00Z';
    expect(holidayReminderStage(created,new Date('2026-11-21T01:59:59Z'))).toBeNull();
    expect(holidayReminderStage(created,new Date('2026-11-21T02:00:00Z'))).toBe('reminder_1');
    expect(holidayReminderStage(created,new Date('2026-11-23T02:00:00Z'))).toBe('reminder_3');
    const invoice={status:'PENDING',due_date:'2026-11-25'};
    expect(holidayReminderAllowed(invoice,new Date('2026-11-23T01:59:59Z')).withinHours).toBe(false);
    expect(holidayReminderAllowed(invoice,new Date('2026-11-23T02:00:00Z')).withinHours).toBe(true);
    expect(holidayReminderAllowed(invoice,new Date('2026-11-23T13:00:00Z')).withinHours).toBe(false);
    expect(holidayReminderAllowed({...invoice,status:'PAID'},new Date()).active).toBe(false);
    expect(holidayReminderAllowed({...invoice,due_date:'2020-01-01'},new Date()).active).toBe(false);
  });
  it('permits the Meta script only when Holiday policy is explicitly selected',()=>{
    expect(buildContentSecurityPolicy()).not.toContain('connect.facebook.net');
    expect(buildContentSecurityPolicy({holidayMeasurement:true})).toContain('https://connect.facebook.net');
    expect(buildContentSecurityPolicy({holidayMeasurement:true})).not.toContain('unsafe-eval');
  });
});
