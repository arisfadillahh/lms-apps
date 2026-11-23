import { NextResponse } from 'next/server';
import { buildContentSecurityPolicy } from '@/lib/security/contentSecurityPolicy';

export function GET() {
  const pixel=process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if(!pixel||!/^\d+$/.test(pixel))return new NextResponse('',{status:204});
  // Sandboxed without same-origin access: cannot read parent invoice tokens,
  // cookies or localStorage. Only an event name, public ID and value cross in.
  const html=`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Holiday measurement</title><meta name="referrer" content="no-referrer"></head><body><script>
  const q=function(...args){if(q.callMethod)q.callMethod(...args);else q.queue.push(args)};q.queue=[];q.push=q;q.loaded=true;q.version='2.0';window.fbq=q;window._fbq=q;
  q('set','autoConfig',false,'${pixel}');q('init','${pixel}');
  const done=new Set();
  addEventListener('message',event=>{
    if(event.source!==parent||event.origin!==${JSON.stringify(new URL(process.env.NEXTAUTH_URL||'https://lms.clev.io').origin)})return;
    const d=event.data;
    if(d?.type!=='HOLIDAY_MEASURE'||!['CompleteRegistration','InitiateCheckout'].includes(d.name)||typeof d.id!=='string'||!/^[a-zA-Z0-9:-]{1,100}$/.test(d.id)||typeof d.nonce!=='string')return;
    if(!q.callMethod)return;
    if(!done.has(d.name+':'+d.id)){
      q('trackSingle','${pixel}',d.name,Number.isFinite(d.value)&&d.value>=0?{value:d.value,currency:'IDR'}:{},{eventID:d.id});done.add(d.name+':'+d.id);
    }
    parent.postMessage({type:'HOLIDAY_MEASURED',nonce:d.nonce},event.origin);
  });
  </script><script async src="https://connect.facebook.net/en_US/fbevents.js"></script></body></html>`;
  return new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':buildContentSecurityPolicy({holidayMeasurement:true})}});
}
