import {createHash,timingSafeEqual} from 'node:crypto';
export function holidaySandboxConfig(env) {
  const key=env.MIDTRANS_SANDBOX_SERVER_KEY||env.MIDTRANS_SERVER_KEY;
  if(env.MIDTRANS_IS_PRODUCTION==='true'||(env.MIDTRANS_SERVER_KEY&&!env.MIDTRANS_SERVER_KEY.startsWith('SB-Mid-server-'))
    ||(key&&!/^SB-Mid-server-[A-Za-z0-9_-]+$/.test(key)))throw Error('REFUSED: production/live or unrecognized Midtrans configuration.');
  // The runner never uses an external database, even when these variables exist.
  for(const name of ['DATABASE_URL','SUPABASE_DB_URL','NEXT_PUBLIC_SUPABASE_URL']) {
    if(!env[name])continue;
    let u;try{u=new URL(env[name]);}catch{throw Error('REFUSED: invalid database URL');}
    if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('REFUSED: external/production database configuration detected.');
  }
  const required={MIDTRANS_SANDBOX_SERVER_KEY:key,META_CONVERSIONS_API_TOKEN:env.META_CONVERSIONS_API_TOKEN,META_TEST_EVENT_CODE:env.META_TEST_EVENT_CODE,NEXT_PUBLIC_META_PIXEL_ID:env.NEXT_PUBLIC_META_PIXEL_ID};
  const missing=Object.keys(required).filter(name=>!required[name]);
  if(missing.length)return {ready:false,missing};
  if(!/^\d+$/.test(required.NEXT_PUBLIC_META_PIXEL_ID)||!/^[A-Za-z0-9_-]+$/.test(required.META_TEST_EVENT_CODE))throw Error('REFUSED: invalid Meta test configuration');
  return {ready:true,key,pixelId:required.NEXT_PUBLIC_META_PIXEL_ID,metaToken:required.META_CONVERSIONS_API_TOKEN,testCode:required.META_TEST_EVENT_CODE};
}

export function verifySandboxNotification(payload,key,orderId,total) {
  if(!key.startsWith('SB-Mid-server-')&&key!=='mock-only-no-credential')throw Error('REFUSED: invalid notification test key');
  if(payload.order_id!==orderId||Number(payload.gross_amount)!==total||!['settlement','capture'].includes(payload.transaction_status)
    ||payload.transaction_status==='capture'&&payload.fraud_status!=='accept')throw Error('Invalid test settlement identity or status');
  if(!/^[a-f0-9]{128}$/.test(payload.signature_key??''))throw Error('Invalid test notification signature');
  const expected=createHash('sha512').update(String(payload.order_id)+payload.status_code+payload.gross_amount+key).digest();
  if(!timingSafeEqual(expected,Buffer.from(payload.signature_key,'hex')))throw Error('Invalid test notification signature');
}

export function assertSandboxUrl(value) {
  const url=new URL(value);
  if(url.protocol!=='https:'||!['api.sandbox.midtrans.com','simulator.sandbox.midtrans.com'].includes(url.hostname)||url.username||url.password||url.port)throw Error('REFUSED: URL is not an official Midtrans Sandbox endpoint');
  return url;
}
