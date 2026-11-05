import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { parseLegacySheet, withoutUnlabelledExtras, latestLegacySnapshot } from '../src/lib/payroll/legacyImport.ts';
import { calculateSynchronizedPeriod } from '../src/lib/payroll/synchronizedPeriod.ts';
import { createPeriod } from '../src/lib/payroll/model.ts';
const base='http://127.0.0.1:3005';assert.equal((await fetch('http://127.0.0.1:4055/health').then(r=>r.json())).local,true);
const bundle=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),manifest=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const snapshots=bundle.snapshots.map(s=>withoutUnlabelledExtras(parseLegacySheet(s,createHash('sha256').update(JSON.stringify(s.cells)).digest('hex'),s.file.name==='Sheet otomasi'?'2026-11':undefined)));
const people=[...new Map(Object.values(manifest.links).filter(l=>l.status==='LINKED').map(l=>[l.profile_id,{id:l.profile_id,user_id:l.user_id,name:l.name,kind:l.kind,job_title:l.kind==='COACH'?'Coach':'Staf',active:true,staff_phone:null}])).values()];
const documents=new Map();
for(const id of [...new Set(snapshots.map(s=>s.period))]){
 const [year,month]=id.split('-').map(Number),p={...createPeriod(year,month),legacy_imports:snapshots.filter(s=>s.period===id),legacy_links:manifest.links};
 const document=calculateSynchronizedPeriod({period:p,people,terms:[],cards:[],includeRecurring:false});
 const chosen=latestLegacySnapshot(p.legacy_imports),expected=chosen.rows.filter(r=>manifest.links[r.sourceId]?.status==='LINKED').reduce((n,r)=>n+r.total,0);
 assert.equal(document.slips.reduce((n,s)=>n+s.total,0),expected,id);
 assert.deepEqual(calculateSynchronizedPeriod({period:document,people,terms:[],cards:[],includeRecurring:false}).slips,document.slips);
 documents.set(id,{id,revision:1,document});
}
console.log('PASS all 13 monthly totals reconcile to matched recipients; repeated sync does not duplicate payroll.');
const out='.codex-maintenance/qa-payroll-unified';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/api/admin/payroll*',async route=>{
  if(route.request().method()==='GET'){
   const response=await route.fetch(),data=await response.json(),url=new URL(route.request().url());
   const id=`${url.searchParams.get('year')}-${String(url.searchParams.get('month')).padStart(2,'0')}`;
   return route.fulfill({response,json:{...data,people,selected:documents.get(id),periods:[...documents.values()].map(r=>({id:r.id,status:r.document.status,version:1}))}});
  }
  const body=route.request().postDataJSON(),record=documents.get(body.periodId);assert.ok(record);
  if(body.action==='component')record.document.manual.push({id:'qa-extra',profile_id:body.profileId,label:body.label,amount:body.amount,reason:body.reason,date:body.date+'T12:00:00+07:00'});
  else assert.ok(['calculate','refreshSource'].includes(body.action),'QA must not deliver or transfer.');
  if(body.action!=='component')record.document=calculateSynchronizedPeriod({period:record.document,people,terms:[],cards:[],includeRecurring:false});
  record.revision++;return route.fulfill({json:{result:record}});
 });
 await page.goto(base+'/login');await page.locator('[name=username]').fill('finance.demo');await page.locator('[name=password]').fill('DemoLokal2026!');await page.getByRole('button',{name:'Masuk',exact:true}).click();await page.waitForURL('**/admin/payroll');
 await page.getByRole('tab',{name:'Rekap penerima',exact:true}).waitFor();
 assert.equal(await page.getByRole('tab',{name:/Rekap sistem lama|Rekap LMS/}).count(),0);assert.doesNotMatch(await page.locator('main').innerText(),/n8n|sistem lama|Total sumber/);
 const person=people.find(p=>p.name==='Arya Perdana'),slip=documents.get('2026-11').document.slips.find(s=>s.profile_id===person.id);
 const row=page.getByRole('row').filter({hasText:person.name});await row.getByRole('button',{name:'Rincian',exact:true}).click();
 let dialog=page.getByRole('dialog');await dialog.getByText('Total periode',{exact:true}).waitFor();
 assert.equal(await dialog.locator('tbody tr').count(),2);assert.ok((await dialog.innerText()).includes('Rp270.000'));
 await page.waitForTimeout(350);await page.screenshot({path:out+'/rincian-desktop.png'});
 await dialog.getByRole('button',{name:/Tampilkan \d+ komponen kosong/}).click();assert.ok(await dialog.locator('tbody tr').count()>2);
 await dialog.getByRole('button',{name:'Sembunyikan komponen kosong',exact:true}).click();
 await dialog.getByRole('button',{name:'Tambahan / potongan',exact:true}).click();
 await dialog.locator('[name=label]').fill('Tunjangan uji');await dialog.locator('[name=amount]').fill('10000');await dialog.locator('[name=reason]').fill('Komponen QA pada fixture browser');
 await dialog.getByRole('button',{name:'Simpan komponen',exact:true}).click();await dialog.getByText('Rp280.000',{exact:true}).waitFor();
 assert.equal(documents.get('2026-11').document.slips.find(s=>s.profile_id===person.id).total,slip.total+10000);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Perbarui rekap',exact:true}).click();await page.getByText('Rekap diperbarui.',{exact:true}).waitFor();
 await row.getByRole('button',{name:'Rincian',exact:true}).click();await dialog.getByText('Rp280.000',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.screenshot({path:out+'/rincian-mobile.png'});
 assert.ok((await dialog.boundingBox()).height<=844);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.keyboard.press('Escape');await page.getByLabel('Tahun arsip').fill('2025');await page.getByLabel('Bulan arsip').selectOption('12');
 await page.getByRole('tab',{name:'Rekap penerima',exact:true}).waitFor();assert.ok(await page.locator('tbody tr').count()>0);
 await page.setViewportSize({width:1366,height:900});await page.waitForTimeout(350);await page.screenshot({path:out+'/rekap-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS one recipient recap; compact combined detail; zero-row toggle; adjustment updates total immediately; refresh preserves correction; historical filter; desktop/mobile; no JS errors.');
}finally{await browser.close();}
