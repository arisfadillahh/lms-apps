import 'server-only';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { normalizeIndonesianPhone } from '@/lib/phoneNumbers';
import { holidayEventId, type HolidayAttribution } from '@/lib/holidayAttribution';

type EventName = 'CompleteRegistration'|'InitiateCheckout'|'Purchase';
type MetaEvent = { id:number;registration_id:string;event_name:EventName;event_id:string;event_time:string;value:number|null;attempts:number;claimed_at:string };

export function buildHolidayMetaEvent(event: Pick<MetaEvent,'event_name'|'event_id'|'event_time'|'value'>, phone:string, attribution:HolidayAttribution = {}) {
  return { event_name:event.event_name,event_id:event.event_id,event_time:Math.floor(Date.parse(event.event_time)/1000),
    action_source:'website',event_source_url:'https://lms.clev.io/holiday-class/',
    user_data:{ph:[createHash('sha256').update(normalizeIndonesianPhone(phone)).digest('hex')],
      ...(attribution.fbp ? {fbp:attribution.fbp}:{}),...(attribution.fbc ? {fbc:attribution.fbc}:{}),
      ...(attribution.client_user_agent ? {client_user_agent:attribution.client_user_agent}:{}),
      ...(attribution.client_ip_address ? {client_ip_address:attribution.client_ip_address}:{}),
    },...(event.value===null?{}:{custom_data:{value:event.value,currency:'IDR'}}) };
}

export async function queueHolidayConversion(invoiceId:string, name:EventName, value:number, eventTime=new Date().toISOString()) {
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('holiday_class_registrations' as never).select('id,attribution,invoices!inner(invoice_number)').eq('invoice_id',invoiceId).single();
  if(error||!data)throw new Error('Holiday measurement registration unavailable');
  const row=data as unknown as {id:string;attribution:HolidayAttribution|null;invoices:{invoice_number:string}};
  if(row.attribution?.measurement!==true)return null;
  const eventId=holidayEventId(name,row.id,row.invoices.invoice_number);
  const result=await db.from('holiday_class_meta_outbox' as never).upsert({registration_id:row.id,event_name:name,event_id:eventId,event_time:eventTime,value} as never,{onConflict:'event_name,event_id',ignoreDuplicates:true});
  if(result.error)throw new Error('Holiday measurement could not be queued');
  return eventId;
}

let warnedMissingConfig=false;
export async function deliverHolidayConversions() {
  const token=process.env.META_CONVERSIONS_API_TOKEN,pixelId=process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if(!token||!pixelId||!/^\d+$/.test(pixelId)) {
    if(!warnedMissingConfig){console.warn('[Holiday Meta] WARNING: META_CONVERSIONS_API_TOKEN or Pixel ID missing; events remain queued.');warnedMissingConfig=true;}
    return {sent:0,skipped:true};
  }
  const db=getSupabaseAdmin();
  const {data,error}=await db.rpc('claim_holiday_meta_events' as never);
  if(error)throw new Error('Holiday Meta queue unavailable');
  let sent=0;
  for(const event of (data??[]) as MetaEvent[]) {
    let lastError:string|null=null;
    try {
      const {data:registration,error:lookup}=await db.from('holiday_class_registrations' as never).select('attribution,invoices!inner(parent_phone)').eq('id',event.registration_id).single();
      if(lookup||!registration)throw new Error('Registration unavailable');
      const row=registration as unknown as {attribution:HolidayAttribution;invoices:{parent_phone:string}};
      const response=await fetch(`https://graph.facebook.com/v23.0/${pixelId}/events`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(5000),body:JSON.stringify({
        data:[buildHolidayMetaEvent(event,row.invoices.parent_phone,row.attribution)],
        ...(process.env.META_TEST_EVENT_CODE?{test_event_code:process.env.META_TEST_EVENT_CODE}:{}),
      })});
      const result=await response.json().catch(()=>null);
      if(!response.ok||result?.events_received!==1)throw new Error(`Meta HTTP ${response.status}; code ${Number(result?.error?.code)||'unknown'}`);
      sent++;
    } catch(error){lastError=error instanceof Error?error.message:'Meta delivery failed';}
    const saved=await db.from('holiday_class_meta_outbox' as never).update({claimed_at:null,sent_at:lastError?null:new Date().toISOString(),last_error:lastError,next_attempt_at:new Date(Date.now()+Math.min(360,2**event.attempts)*60_000).toISOString()} as never).eq('id',event.id).eq('claimed_at',event.claimed_at);
    if(saved.error)throw new Error('Holiday Meta delivery state unavailable');
  }
  return {sent,skipped:false};
}
