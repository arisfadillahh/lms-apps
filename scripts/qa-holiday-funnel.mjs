// Local-only QA: synthetic invoice data, intercepted payment instructions, no messages/payments.
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';
import QRCode from 'qrcode';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root=process.cwd(),out=path.join(root,'.data/qa/holiday-funnel');
await fs.mkdir(out,{recursive:true});
const secret='local-build-validation-only';
let paid=false;
const invoice={id:'00000000-0000-4000-8000-000000000091',invoice_number:'HC-2627-999991',parent_name:'Orang Tua QA',parent_phone:'6281234567890',seasonal_student_name:'Peserta QA',seasonal_student_phone:'6281234567890',invoice_type:'SEASONAL',status:'PENDING',total_amount:900000,created_at:'2026-11-23T02:00:00Z',due_date:'2026-11-24',period_month:12,period_year:2026,period_start_date:'2026-12-14',period_end_date:'2026-12-23',ccr_numbers:null,items:['Scratch Jr.','Kodu','Minecraft Builder'].map((name,i)=>({id:'qa-item-'+i,class_name:name,level_name:'Explorer',coder_name:'Peserta QA',description:`${14+i*3}–${16+i*3} Desember 2026 · 09.00 WIB · 90 menit/sesi`,base_price:350000,discount_amount:50000,final_price:300000}))};
const token=n=>createHmac('sha256',secret).update(n+'|'+invoice.parent_phone).digest('base64url');
const require=createRequire(import.meta.url);
const Module=require('node:module');
const originalResolve=Module._resolveFilename;
const oldTs=require.extensions['.ts'],oldTsx=require.extensions['.tsx'];
let baselineHtml;
try {
  Module._resolveFilename=function(name,...args){return originalResolve.call(this,name.startsWith('@/')?path.join(root,'src',name.slice(2)):name,...args);};
  const compile=(loadedModule,file)=>loadedModule._compile(ts.transpileModule(require('node:fs').readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
  require.extensions['.ts']=compile;require.extensions['.tsx']=compile;
  const source=require('node:child_process').execFileSync('git',['show','fc93c86:src/app/(public)/invoice/[invoiceNumber]/InvoiceView.tsx'],{encoding:'utf8'});
  const file=path.join(root,'src/app/(public)/invoice/[invoiceNumber]/baseline-qa.tsx');
  const baselineModule=new Module(file);baselineModule.filename=file;baselineModule.paths=Module._nodeModulePaths(path.dirname(file));
  baselineModule._compile(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
  const markup=renderToStaticMarkup(React.createElement(baselineModule.exports.default,{invoice,publicToken:token(invoice.invoice_number),paymentOptions:[],initialPayment:null,bankInfo:null}));
  baselineHtml='<!doctype html><html lang="id"><head><base href="http://localhost:3210"><meta name="viewport" content="width=1024, initial-scale=0.35"><style>body{margin:0;font-family:Arial,sans-serif}</style></head><body>'+markup+'</body></html>';
} finally {Module._resolveFilename=originalResolve;if(oldTs)require.extensions['.ts']=oldTs;else delete require.extensions['.ts'];if(oldTsx)require.extensions['.tsx']=oldTsx;else delete require.extensions['.tsx'];}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Content-Type','application/json');
  if(url.pathname==='/qa-before-invoice'){res.setHeader('Content-Type','text/html');res.end(baselineHtml);return;}
  if(url.pathname==='/rest/v1/invoices') {
    const old=url.searchParams.get('invoice_number')?.includes('CCR-QA');
    const data={...invoice,invoice_number:old?'CCR-QA-112026':invoice.invoice_number,status:paid?'PAID':'PENDING',paid_at:paid?'2026-11-23T03:00:00Z':null,invoice_type:old?'MONTHLY':'SEASONAL'};
    res.end(JSON.stringify(data));return;
  }
  if(url.pathname==='/rest/v1/invoice_settings'){res.end(JSON.stringify({admin_whatsapp_number:'6281234567890'}));return;}
  res.end('[]');
});
await new Promise(resolve=>server.listen(54490,'127.0.0.1',resolve));
const log=await fs.open(path.join(out,'next.log'),'w');
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3210'],{cwd:root,env:{...process.env,NODE_ENV:'production',NEXTAUTH_SECRET:secret,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54490',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-validation',SUPABASE_SERVICE_ROLE_KEY:'local-validation',NEXTAUTH_URL:'http://localhost:3210',LMS_INVOICE_PAYMENT_STORE_DIR:path.join(out,'empty-store')},stdio:['ignore',log.fd,log.fd]});
let browser;
try {
  for(let n=0;n<60;n++){try{if((await fetch('http://localhost:3210/login')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='connect.facebook.net')return route.fulfill({contentType:'application/javascript',body:'window.fbq.callMethod=(...args)=>{window.lastMeasuredEvent=args;};'});
    if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();
    return route.continue();
  });
  let qrCalls=0;
  await page.route('**/api/invoices/*/payment-method',async route=>{
    const body=route.request().postDataJSON(),isQr=body.method==='qris';
    if(isQr)qrCalls++;
    return route.fulfill({json:{ok:true,eventId:'checkout:'+invoice.invoice_number,expiresAt:qrCalls===1&&isQr?'2020-01-01T00:00:00Z':'2099-01-01T00:00:00Z',payment:{method:body.method,label:isQr?'QRIS':'BNI Virtual Account',baseAmount:900000,adminFee:2500,total:902500,feeLabel:'Rp2.500',bank:isQr?null:'bni',vaNumber:isQr?null:'9881234567890',billerCode:null,billKey:null,deeplinkUrl:null,qrImageUrl:isQr?'/qa-qr.png':null}}});
  });
  await page.route('**/qa-qr.png',async route=>route.fulfill({body:await QRCode.toBuffer('LOCAL QA ONLY - NOT A PAYMENT'),contentType:'image/png'}));
  const url='http://localhost:3210/invoice/'+invoice.invoice_number+'?t='+token(invoice.invoice_number);
  const headers=await fetch(url);
  if(!headers.headers.get('content-security-policy')?.includes('connect.facebook.net'))throw Error('Holiday CSP missing Pixel allowlist');
  const regularUrl='http://localhost:3210/invoice/CCR-QA-112026?t='+token('CCR-QA-112026');
  const ordinary=await fetch(regularUrl);
  if(ordinary.headers.get('content-security-policy')?.includes('connect.facebook.net'))throw Error('Monthly CSP unexpectedly loosened');
  for(const width of [360,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('http://localhost:54490/qa-before-invoice');
    await page.screenshot({path:path.join(out,`before-holiday-invoice-${width}.png`),fullPage:true});
    await page.goto(regularUrl);await page.waitForTimeout(400);
    await page.screenshot({path:path.join(out,`legacy-invoice-${width}.png`),fullPage:true});
    await page.goto(url);await page.getByRole('heading',{name:'Selesaikan pendaftaran'}).waitFor();
    await page.screenshot({path:path.join(out,`holiday-invoice-${width}.png`),fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw Error('Holiday horizontal overflow at '+width);
    const viewport=await page.locator('meta[name="viewport"]').getAttribute('content');
    if(!viewport.includes('width=device-width'))throw Error('Holiday mobile viewport missing');
  }
  await page.setViewportSize({width:360,height:900});
  await page.getByRole('radio',{name:/BNI Virtual Account/}).check();
  await page.getByRole('button',{name:'Tampilkan pembayaran'}).click();
  await page.getByText('9881234567890').waitFor();
  const bridge=()=>page.frames().find(f=>f.url().endsWith('/holiday-measurement'));
  await page.waitForTimeout(500);
  if(!bridge())throw Error('Token-free measurement bridge missing');
  const measured=await bridge().evaluate(()=>window.lastMeasuredEvent);
  if(!JSON.stringify(measured).includes('InitiateCheckout')||JSON.stringify(measured).includes(token(invoice.invoice_number)))throw Error('Measurement bridge event invalid');
  if(await page.evaluate(()=>Boolean(window.fbq)))throw Error('Pixel unexpectedly loaded in tokenized invoice document');
  await page.screenshot({path:path.join(out,'holiday-va-360.png'),fullPage:true});
  await page.getByRole('button',{name:'Ganti metode pembayaran'}).click();
  await page.getByRole('radio',{name:/QRIS/}).check();
  await page.getByRole('button',{name:'Tampilkan pembayaran'}).click();
  await page.getByRole('button',{name:'Buat QR baru'}).waitFor();
  await page.getByRole('button',{name:'Buat QR baru'}).click();
  await page.getByRole('link',{name:'Simpan QR'}).waitFor();
  if(qrCalls!==2)throw Error('QR regeneration did not occur');
  await page.screenshot({path:path.join(out,'holiday-qris-360.png'),fullPage:true});
  paid=true;await page.reload();
  await page.getByRole('heading',{name:'Pembayaran diterima'}).waitFor();
  if(await page.getByRole('button',{name:'Tampilkan pembayaran'}).count())throw Error('Paid invoice still offers payment');
  await page.screenshot({path:path.join(out,'holiday-paid-360.png'),fullPage:true});
  let accessibility;
  if(process.env.QA_LIGHTHOUSE==='true') {
    paid=false;
    await promisify(execFile)('npx',['--yes','--package=lighthouse','lighthouse',url,'--only-categories=accessibility','--output=json','--output-path='+path.join(out,'lighthouse.json'),'--chrome-flags=--headless --no-sandbox','--quiet'],{env:{...process.env,CHROME_PATH:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'},timeout:180000,maxBuffer:1024*1024});
    const audit=JSON.parse(await fs.readFile(path.join(out,'lighthouse.json'),'utf8'));
    accessibility=audit.categories.accessibility.score*100;
    if(accessibility<90)throw Error('Accessibility below 90: '+accessibility);
  }
  const report={passed:true,checks:['Holiday-only CSP','Monthly viewport preserved','Holiday device viewport','360/1280 no overflow','VA display','QR expiry and regeneration','paid state','token-free sandboxed Pixel bridge'],accessibility,pageErrors:errors,screenshots:out};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();app.kill('SIGTERM');await new Promise(resolve=>server.close(resolve));await log.close();}
