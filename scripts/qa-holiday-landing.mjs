// Real static form with local API/Pixel stubs. No participant, payment or message is created.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { holidayBatches,holidayLevels,holidayPlatformFee,holidaySessionMinutes } from '../src/lib/holidayClass.ts';
const root=path.join(process.cwd(),'ops/holiday-landing');
const eventId='00000000-0000-4000-8000-000000000092';
let reused=false,body;
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost:3211');
  if(u.pathname==='/api/holiday-class/registration') {
    res.setHeader('Content-Type','application/json');
    if(req.method==='POST') {
      let raw='';for await(const part of req)raw+=part;body=JSON.parse(raw);
      res.end(JSON.stringify({invoiceNumber:'HC-2627-999992',invoiceUrl:'http://localhost:3211/invoice/HC-2627-999992?t=local-qa',eventId,reused}));
    }else res.end(JSON.stringify({batches:holidayBatches,levels:holidayLevels,platformFee:holidayPlatformFee,sessionMinutes:holidaySessionMinutes}));
    return;
  }
  if(u.pathname.startsWith('/invoice/')){res.end('Local invoice QA only');return;}
  const file=u.pathname==='/holiday-class/'?'index.html':path.basename(u.pathname);
  if(!['index.html','preview2-v9.css','preview2-v4.js','registration-v2.css','registration-v6.js','meta-tracking-v1.css','meta-tracking-v3.js'].includes(file)){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(await fs.readFile(path.join(root,file)));
});
await new Promise(resolve=>server.listen(3211,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://connect.facebook.net/**',route=>route.fulfill({contentType:'application/javascript',body:`window.fbq.callMethod=(...args)=>{const old=JSON.parse(sessionStorage.getItem('qa-events')||'[]');old.push(args);sessionStorage.setItem('qa-events',JSON.stringify(old));};`}));
  async function fill() {
    await page.goto('http://localhost:3211/holiday-class/?utm_source=facebook&utm_campaign=qa&fbclid=qa-click');
    await page.locator('[data-holiday-register]:visible').first().click();
    await page.locator('#registration-grade').selectOption('1');
    await page.locator('select[name="program-0"]').selectOption('0');
    await page.locator('select[name="batch-0"]').selectOption('0');
    await page.locator('#registration-next').click();
    await page.locator('[name="parentName"]').fill('Orang Tua QA');
    await page.locator('[name="studentName"]').fill('Peserta QA');
    await page.locator('[name="phone"]').fill('081234567890');
    await page.locator('[name="consent"]').check();
    await page.locator('#registration-submit').click();
  }
  await fill();await page.waitForURL('**/invoice/**');
  const events=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-events')||'[]'));
  const registration=events.find(e=>e[2]==='CompleteRegistration');
  if(registration?.[4]?.eventID!==eventId)throw Error('Registration event lost before redirect or used the request UUID');
  if(body.attribution.utm_source!=='facebook'||body.attribution.fbclid!=='qa-click')throw Error('Attribution missing');
  if('email' in body)throw Error('Form unexpectedly requests email');
  reused=true;await fill();await page.locator('#registration-reuse-edit').waitFor({state:'visible'});
  if(!page.url().includes('/holiday-class/'))throw Error('Duplicate order skipped the existing-invoice choice');
  await page.getByRole('link',{name:'Lanjut ke invoice sebelumnya'}).waitFor();
  await page.locator('#registration-reuse-edit').click();
  await page.locator('#registration-schedule').waitFor({state:'visible'});
  await page.locator('#bundle-toggle').click();
  await page.locator('select[name="program-1"]').selectOption('1');
  if(!await page.locator('select[name="batch-1"] option[value="0"]').evaluate(option=>option.disabled))throw Error('Overlapping batch was selectable');
  console.log(JSON.stringify({passed:true,checks:['real static form','no email field','canonical event before redirect','UTM/fbclid capture','duplicate-order choice','overlapping batch disabled']}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
