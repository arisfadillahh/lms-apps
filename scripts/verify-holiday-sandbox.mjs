// No dotenv, no external DB, no WA imports/transport. Secrets are never printed or persisted.
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {holidaySandboxConfig,assertSandboxUrl,verifySandboxNotification} from './lib/holiday-sandbox-safety.mjs';

export async function runHolidaySandbox({env=process.env,args=process.argv.slice(2),request=fetch,log=console.log}={}) {
  const config=holidaySandboxConfig(env); // Guards precede imports, filesystem or network activity.
  const mock=args.includes('--mock');
  if(!config.ready&&!mock){log('SKIPPED: sandbox/test configuration missing: '+config.missing.join(', ')+'. No requests, database writes or WhatsApp sent.');return {skipped:true};}
  const root=process.cwd(),dir=path.join(root,'.data/qa/holiday-sandbox');
  await fs.mkdir(dir,{recursive:true});
  const stateFile=path.join(dir,'state.json');
  const db=await PGlite.create(path.join(dir,mock?'mock-db':'sandbox-db'));
  const file=mock?path.join(dir,'mock-state.json'):stateFile;
  let state;
  try {
    try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch{state=null;}
    if(state&&!args.includes('--resume'))throw Error('Existing test run found. Use --resume; no duplicate Sandbox orders were created.');
    if(!state) {
      await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
        CREATE TABLE invoices(id uuid primary key default gen_random_uuid(),invoice_number text,parent_name text,parent_phone text,seasonal_student_name text,seasonal_student_phone text,
        period_month int,period_year int,period_start_date date,period_end_date date,total_amount int,due_date date,status text,invoice_type text,created_at timestamptz default now(),updated_at timestamptz,paid_at timestamptz,paid_notes text,payment_method text,payment_total_amount int);
        CREATE TABLE invoice_items(invoice_id uuid references invoices(id) on delete cascade,coder_name text,class_name text,level_name text,description text,base_price int,discount_amount int,final_price int);`);
      for(const migration of ['20261112160000_holiday_class_registration.sql','20261123090000_holiday_funnel.sql','20261123093000_holiday_meta_outbox.sql','20261123110000_holiday_three_day_validity.sql'])await db.exec(await fs.readFile(path.join(root,'supabase/migrations',migration),'utf8'));
      state={mock,runId:randomUUID().slice(0,8),orders:[],meta:[]};
      await fs.writeFile(file,JSON.stringify(state,null,2),{mode:0o600});
    }
    if(state.mock!==mock)throw Error('Test state mode mismatch');
    const auth=config.ready?`Basic ${Buffer.from(config.key+':').toString('base64')}`:null;
    async function provider(url,body) {
      assertSandboxUrl(url);
      if(mock)throw Error('Mock attempted external request');
      const response=await request(url,{method:body?'POST':'GET',headers:{Authorization:auth,Accept:'application/json','Content-Type':'application/json',
        // Never allow the Sandbox merchant default to notify a production LMS.
        'X-Override-Notification':'https://example.invalid/holiday-sandbox-notifications-disabled'},
      ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data||!['200','201'].includes(String(data.status_code)))throw Error(`Sandbox HTTP ${response.status}; code ${String(data?.status_code??'unknown').replace(/[^0-9]/g,'')}`);
      return data;
    }
    for(const method of ['qris','bni_va']) {
      let order=state.orders.find(o=>o.method===method);
      if(!order) {
        const registrationId=randomUUID();
        const start=new Date(Date.now()+30*86400_000).toISOString().slice(0,10);
        const details={parentName:'Orang Tua QA',studentName:'Peserta QA '+method,phone:'6280000000000',email:'',schoolGrade:1,platform:'none',level:'Explorer',selections:[{name:'Scratch Jr.',batch:'Synthetic Sandbox only',start,end:start,time:'09.00'}],startDate:start,endDate:start,total:350000,dueDays:3,items:[{name:'Scratch Jr.',description:'Synthetic Sandbox only',basePrice:350000,discount:0,total:350000}],attribution:{measurement:true}};
        const r=await db.query('select create_holiday_class_registration($1,$2,$3) as id',[registrationId,createHash('sha256').update(registrationId).digest('hex'),details]);
        const invoice=(await db.query('select id,invoice_number from invoices where id=$1',[r.rows[0].id])).rows[0];
        order={method,registrationId,invoiceId:invoice.id,invoiceNumber:invoice.invoice_number,orderId:`HC-QA-${state.runId}-${method}`,total:352500,phase:'CREATING'};
        state.orders.push(order);await fs.writeFile(file,JSON.stringify(state,null,2),{mode:0o600});
        const issued=mock?{status_code:'201',order_id:order.orderId,gross_amount:'352500.00',transaction_status:'pending',transaction_id:randomUUID(),actions:[{name:'generate-qr-code',url:'https://api.sandbox.midtrans.com/v2/qris/qa/qr-code'}],va_numbers:[{bank:'bni',va_number:'988000000000'}]}:await provider('https://api.sandbox.midtrans.com/v2/charge',{
          payment_type:method==='qris'?'qris':'bank_transfer',transaction_details:{order_id:order.orderId,gross_amount:order.total},
          ...(method==='qris'?{qris:{acquirer:'gopay'}}:{bank_transfer:{bank:'bni'}}),
          item_details:[{id:'holiday-qa',price:350000,quantity:1,name:'Holiday Class QA'},{id:'admin-qa',price:2500,quantity:1,name:'Biaya admin QA'}],
        });
        if(issued.order_id!==order.orderId||Number(issued.gross_amount)!==order.total)throw Error('Sandbox instruction identity mismatch');
        order.phase='READY';order.instructions=method==='qris'?{qrUrl:issued.actions?.find(a=>a.name==='generate-qr-code')?.url,qrString:issued.qr_string}:{va:issued.va_numbers?.find(v=>v.bank==='bni')?.va_number};
        if(method==='qris'&&!order.instructions.qrUrl&&!order.instructions.qrString)throw Error('Sandbox QRIS missing');
        if(order.instructions.qrUrl)assertSandboxUrl(order.instructions.qrUrl);
        if(method==='bni_va'&&!order.instructions.va)throw Error('Sandbox BNI VA missing');
        await db.query('update invoices set payment_method=$1,payment_total_amount=$2 where id=$3',[method,order.total,invoice.id]);
        await fs.writeFile(file,JSON.stringify(state,null,2),{mode:0o600});
      }
      if(order.phase!=='READY')throw Error('Previous issuance is ambiguous. Inspect the Sandbox Dashboard; no automatic duplicate was issued.');
      const status=mock?{order_id:order.orderId,gross_amount:'352500.00',transaction_status:'settlement',status_code:'200'}:await provider(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(order.orderId)}/status`);
      if(status.order_id!==order.orderId||Number(status.gross_amount)!==order.total)throw Error('Authoritative Sandbox status identity mismatch');
      if(status.transaction_status==='settlement'||status.transaction_status==='capture'&&status.fraud_status==='accept') {
        // Simulate receipt/replay locally only AFTER provider settlement is confirmed.
        const paidAt=new Date().toISOString();
        const key=config.ready?config.key:'mock-only-no-credential';
        const signature=()=>createHash('sha512').update(order.orderId+status.status_code+status.gross_amount+key).digest();
        const notification={...status,signature_key:signature().toString('hex')};
        verifySandboxNotification(notification,key,order.orderId,order.total);
        for(let n=0;n<2;n++)await db.query('select settle_holiday_class_invoice_measured($1,$2,$3,$4)',[order.invoiceNumber,350000,order.total,paidAt]);
        const rows=await db.query("select event_id,value from holiday_class_meta_outbox where registration_id=$1 and event_name='Purchase'",[order.registrationId]);
        if(rows.rows.length!==1||rows.rows[0].event_id!==order.invoiceNumber||rows.rows[0].value!==order.total)throw Error('Purchase replay or ID mismatch');
        order.settled=true;
      } else if(!mock) {
        log(`PENDING ${method}: pay order ${order.orderId} using https://simulator.sandbox.midtrans.com/ then rerun with --resume. Instructions: ${file}`);
      }
    }
    const events=(await db.query('select * from holiday_class_meta_outbox order by id')).rows;
    for(const event of events) {
      const order=state.orders.find(o=>o.registrationId===event.registration_id);
      const expected=event.event_name==='CompleteRegistration'?order.registrationId:event.event_name==='InitiateCheckout'?'checkout:'+order.invoiceNumber:order.invoiceNumber;
      if(event.event_id!==expected)throw Error('Event ID mismatch');
      if(state.meta.includes(event.id))continue;
      if(!mock) {
        const eventData={event_name:event.event_name,event_id:event.event_id,event_time:Math.floor(new Date(event.event_time).getTime()/1000),action_source:'website',event_source_url:'https://example.invalid/holiday-sandbox-test',user_data:{ph:[createHash('sha256').update('6280000000000').digest('hex')]},custom_data:{value:event.value,currency:'IDR'}};
        const response=await request(`https://graph.facebook.com/v23.0/${config.pixelId}/events`,{method:'POST',headers:{Authorization:`Bearer ${config.metaToken}`,'Content-Type':'application/json'},body:JSON.stringify({test_event_code:config.testCode,data:[eventData]}),redirect:'error',signal:AbortSignal.timeout(15000)});
        const result=await response.json().catch(()=>null);
        if(!response.ok||result?.events_received!==1)throw Error(`Meta test event not accepted: HTTP ${response.status}`);
      }
      state.meta.push(event.id);
      await fs.writeFile(file,JSON.stringify(state,null,2),{mode:0o600});
      log(`${mock?'MOCK':'ACCEPTED'} ${event.event_name} ${event.event_id}`);
    }
    const complete=state.orders.every(o=>o.settled)&&events.filter(e=>e.event_name==='Purchase').length===2;
    const report={mock,complete,events:events.map(e=>({name:e.event_name,eventId:e.event_id,value:e.value})),whatsappSent:0,database:'local PGlite only',browserDedupVerified:false};
    await fs.writeFile(path.join(dir,mock?'mock-report.json':'report.json'),JSON.stringify(report,null,2));
    log(JSON.stringify(report));return report;
  } finally {await db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runHolidaySandbox().catch(()=>{console.error('Sandbox verification stopped safely. No live key, production DB or WhatsApp transport was used. Check test configuration and local state; no secret details are printed.');process.exitCode=1;});
