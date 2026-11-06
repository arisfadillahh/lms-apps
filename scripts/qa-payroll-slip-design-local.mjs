// Presentation-only fixtures: no payroll writes, messages or production access.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base='http://127.0.0.1:3005';
assert.equal((await fetch('http://127.0.0.1:4055/health').then(r=>r.json())).local,true);
const out=path.resolve('.codex-payroll-local/qa-slip-design');fs.mkdirSync(out,{recursive:true});
const line=(key,kind,label,amount,quantity=1)=>({key,kind,label,amount,quantity,rate:amount,date:'2026-11-05T10:00:00Z',details:''});
const staff={profile_id:'20000000-0000-4000-8000-000000009991',user_id:null,name:'Staf Demo Clevio',job_title:'Operasional',kind:'STAFF',contract:'FULLTIME',total:3817400,lines:[line('a','ALLOWANCE','Tunjangan Kuota',250000),line('b','ALLOWANCE','Tunjangan Kesehatan',175000),line('c','ALLOWANCE','Tunjangan BPJSTK',192400),line('salary','SALARY','Gaji pokok',3200000)]};
const coach={...staff,profile_id:'20000000-0000-4000-8000-000000009992',user_id:'coach',name:'Coach Mitra Demo',kind:'COACH',contract:'MITRA',job_title:'Coach',lines:[line('class1','WEEKLY','Nama kelas tidak ditampilkan',140000,2),line('class2','EKSKUL','Nama kelas lain',105000),line('trial','TRIAL','Trial',50000,2),line('goal','GOAL','Goal',500000,5),line('transport','ADJUSTMENT','Transport',75000)]};coach.total=coach.lines.reduce((n,l)=>n+l.amount,0);
const long={...staff,profile_id:'20000000-0000-4000-8000-000000009993',name:'Staf Dengan Nama Panjang Untuk Pemeriksaan Tata Letak Dokumen',lines:[line('salary','SALARY','Gaji pokok',3200000),...Array.from({length:24},(_,i)=>line('allowance'+i,'ALLOWANCE',`Tunjangan ${i+1} - komponen rutin dengan keterangan lengkap`,100000)),line('deduction','ADJUSTMENT','Potongan administrasi',-20000)]};long.total=long.lines.reduce((n,l)=>n+l.amount,0);
const cases=[{name:'staff',slip:staff},{name:'coach',slip:coach},{name:'long-staff',slip:long}];
let active=cases[0];const errors=[];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/admin/payroll*',async route=>{
  assert.equal(route.request().method(),'GET','This QA must never mutate payroll.');
  const response=await route.fetch(),data=await response.json();const document=data.selected.document;
  document.slips=cases.map(c=>c.slip);document.warnings=[];document.status=active.name==='coach'?'FINAL':'DRAFT';document.history=active.name==='coach'?[{version:1,finalized_at:'2026-11-26T00:00:00Z',finalized_by:'local',slips:[coach]}]:[];document.transfers=active.name==='coach'?[{id:'paid',profile_id:coach.profile_id,amount:coach.total,at:'2026-11-26T01:00:00Z',by:'local',reference:'',version:1}]:[];
  return route.fulfill({response,json:data});
 });
 await page.goto(base+'/login');await page.locator('[name=username]').fill('finance.demo');await page.locator('[name=password]').fill('DemoLokal2026!');await page.getByRole('button',{name:'Masuk',exact:true}).click();await page.waitForURL('**/admin/payroll');
 for(const testCase of cases){
  active=testCase;await page.setViewportSize({width:1366,height:900});await page.goto(base+'/admin/payroll');
  await page.getByRole('button',{name:`Pratinjau slip ${testCase.slip.name}`,exact:true}).click();
  const frame=page.frameLocator('iframe[title="Pratinjau slip gaji Clevio"]');await frame.locator('.brand-logo').waitFor();
  await frame.locator('.brand-logo').evaluate(img=>img.decode());
  assert.equal(await frame.locator('table').count(),0);
  assert.equal(await frame.locator('.net-amount').innerText(),`Rp${testCase.slip.total.toLocaleString('id-ID')}`);
  if(testCase.name==='staff')assert.equal(await frame.locator('.earning').first().locator('dt').innerText(),'Gaji pokok');
  const top=await frame.locator('html').evaluate(()=>({scroll:window.scrollY,overflow:document.documentElement.scrollWidth>innerWidth+1,logo:document.querySelector('.brand-logo').getBoundingClientRect().top}));assert.equal(top.scroll,0);assert.equal(top.overflow,false);assert.ok(top.logo>=0);
  await page.waitForTimeout(250);await page.screenshot({path:path.join(out,`${testCase.name}-desktop.png`)});
  const html=await page.locator('iframe').getAttribute('srcdoc'),printPage=await context.newPage();
  await printPage.route('**/*',route=>route.request().url().startsWith('data:')?route.continue():route.abort());
  const logo='data:image/png;base64,'+fs.readFileSync('public/images/clevio-logo.png').toString('base64');
  await printPage.setContent(html.replace('src="/images/clevio-logo.png"',`src="${logo}"`),{waitUntil:'load'});
  await printPage.emulateMedia({media:'print'});
  await printPage.pdf({path:path.join(out,`${testCase.name}.pdf`),format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;text-align:center;font-size:8px;color:#51656f">Clevio LMS · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',margin:{bottom:'18mm'}});await printPage.close();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await frame.locator('html').evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(out,`${testCase.name}-mobile.png`)});
  await frame.locator('.document-footer').scrollIntoViewIfNeeded();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});
  await page.getByRole('button',{name:`Pratinjau slip ${testCase.slip.name}`,exact:true}).click();await frame.locator('.brand-logo').waitFor();assert.equal(await frame.locator('html').evaluate(()=>window.scrollY),0);await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);console.log('PASS staff/coach/long allowance previews, exact totals, salary first, no table, complete logo, mobile overflow, reopened scroll reset, final/paid state, three printable PDF fixtures, no JS errors.');
}finally{await browser.close();}
