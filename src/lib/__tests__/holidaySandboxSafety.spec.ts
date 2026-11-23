import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {holidaySandboxConfig,assertSandboxUrl,verifySandboxNotification} from '../../../scripts/lib/holiday-sandbox-safety.mjs';
describe('Holiday sandbox fail-closed guard',()=>{
  it('skips incomplete configuration without a network request',()=>{
    expect(holidaySandboxConfig({})).toMatchObject({ready:false});
  });
  it('rejects production/live, ambiguous keys and remote databases even in mock mode',()=>{
    for(const env of [{MIDTRANS_IS_PRODUCTION:'true'}, {MIDTRANS_SERVER_KEY:'Mid-server-test-fixture'}, {MIDTRANS_SANDBOX_SERVER_KEY:'live-fixture'},
      {MIDTRANS_SANDBOX_SERVER_KEY:'SB-Mid-server-fixture',MIDTRANS_SERVER_KEY:'Mid-server-fixture'}, {NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}, {DATABASE_URL:'postgres://user@production.example/db'}])expect(()=>holidaySandboxConfig(env)).toThrow(/REFUSED/);
  });
  it('only permits exact official sandbox hosts, never live or lookalike URLs',()=>{
    expect(assertSandboxUrl('https://api.sandbox.midtrans.com/v2/charge').hostname).toBe('api.sandbox.midtrans.com');
    for(const url of ['https://api.midtrans.com/v2/charge','https://api.sandbox.midtrans.com.attacker.example','http://api.sandbox.midtrans.com','https://x@api.sandbox.midtrans.com'])expect(()=>assertSandboxUrl(url)).toThrow(/REFUSED/);
  });
  it('rejects tampered or still-pending simulated notifications',()=>{
    const key='SB-Mid-server-fixture';
    const p={order_id:'QA',gross_amount:'352500.00',status_code:'200',transaction_status:'settlement',signature_key:createHash('sha512').update('QA200352500.00'+key).digest('hex')};
    expect(()=>verifySandboxNotification(p,key,'QA',352500)).not.toThrow();
    expect(()=>verifySandboxNotification({...p,transaction_status:'pending'},key,'QA',352500)).toThrow();
    expect(()=>verifySandboxNotification({...p,signature_key:'a'.repeat(128)},key,'QA',352500)).toThrow();
    expect(()=>verifySandboxNotification(p,key,'OTHER',352500)).toThrow();
  });
});
