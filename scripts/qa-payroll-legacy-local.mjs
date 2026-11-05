/** Read-only browser QA. Import fixtures are intercepted in the browser, never persisted. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';
import { parseLegacySheet, withoutUnlabelledExtras, latestLegacySnapshot } from '../src/lib/payroll/legacyImport.ts';
const base='http://127.0.0.1:3005';
assert.equal((await fetch('http://127.0.0.1:4055/health').then(r=>r.json())).local,true);
const input=process.argv[2]; if(!input)throw new Error('Pass a private source fixture path.');
const links=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3],'utf8')).links:{};
const rawSnapshots=JSON.parse(fs.readFileSync(input,'utf8')).snapshots.map(s=>parseLegacySheet(s,createHash('sha256').update(JSON.stringify(s.cells)).digest('hex'),s.file.name==='Sheet otomasi'?'2026-11':undefined));
const snapshots=rawSnapshots.map(withoutUnlabelledExtras), current=snapshots.find(s=>s.period==='2026-11'), first=current.rows[0], december=snapshots.filter(s=>s.period==='2025-12').sort((a,b)=>b.sourceCreatedAt.localeCompare(a.sourceCreatedAt));
const currency=n=>`Rp${n.toLocaleString('id-ID')}`;
const out='.codex-maintenance/qa-payroll-import';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1366,height:768}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.route('**/api/admin/payroll?*',async route=>{
    const response=await route.fetch(); const body=await response.json();if(response.status()!==200)return route.fulfill({response});
    const url=new URL(route.request().url()),year=Number(url.searchParams.get('year')),month=Number(url.searchParams.get('month')),id=`${year}-${String(month).padStart(2,'0')}`;
    const document=body.selected?.document??{id,year,month,starts_at:new Date(Date.UTC(year,month-2,26,-7)).toISOString(),ends_at:new Date(Date.UTC(year,month-1,26,-7)).toISOString(),correction_deadline:new Date(Date.UTC(year,month-1,25,10)).toISOString(),status:'DRAFT',version:1,slips:[],warnings:[],overrides:{},manual:[],activities:[],transfers:[],deliveries:{},history:[],calculated_at:null};
    body.selected={id,revision:0,document:{...document,legacy_imports:snapshots.filter(s=>s.period===id),legacy_links:links}};
    await route.fulfill({response,json:body});
  });
  await page.goto(base+'/login'); await page.locator('[name=username]').fill('finance.demo');await page.locator('[name=password]').fill('DemoLokal2026!');await page.getByRole('button',{name:'Masuk',exact:true}).click();await page.waitForURL('**/admin/payroll');
  const region=page.getByRole('region',{name:'Rekap impor sistem lama'});await region.waitFor();
  assert.ok((await region.innerText()).includes(currency(current.total)));
  assert.equal(await region.locator('tbody tr').count(),current.rows.length);
  if(Object.keys(links).length){
    assert.ok((await region.innerText()).includes('Arsip saja · tidak ditautkan'));
    const linked=current.rows.find(r=>links[r.sourceId]?.status==='LINKED');
    assert.ok((await region.innerText()).includes(links[linked.sourceId].name));
  }
  assert.equal(await page.getByRole('button',{name:'Hitung ulang',exact:true}).count(),0);
  assert.ok((await region.locator('table').boundingBox()).y<550);
  await page.screenshot({path:out+'/november-desktop.png',fullPage:true});
  await region.getByRole('button',{name:`Rincian sumber ${first.name}`,exact:true}).click();await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(),/Progres aktivitas/); await page.screenshot({path:out+'/rincian-desktop.png'});await page.keyboard.press('Escape');
  await page.getByLabel('Bulan arsip').selectOption('8');await region.waitFor();await region.getByRole('button',{name:`Rincian sumber ${first.name}`,exact:true}).click();
  await page.getByRole('dialog').waitFor();assert.doesNotMatch(await page.getByRole('dialog').innerText(),/AA2/);assert.ok((await page.getByRole('dialog').innerText()).includes(currency(snapshots.find(s=>s.period==='2026-08').rows.find(r=>r.sourceId===first.sourceId).total)));await page.keyboard.press('Escape');
  await page.getByLabel('Tahun arsip').fill('2025');await page.getByLabel('Bulan arsip').selectOption('12');await page.getByLabel('Versi arsip sumber').waitFor();
  assert.equal(await page.getByLabel('Versi arsip sumber').locator('option').count(),december.length);assert.ok((await region.innerText()).includes(currency(latestLegacySnapshot(december).total)));
  await page.getByLabel('Versi arsip sumber').selectOption({index:1});await page.getByText(currency(december[1].total),{exact:true}).waitFor();
  await page.screenshot({path:out+'/december-versions.png'});
  await page.getByLabel('Tahun arsip').fill('2026');await page.getByLabel('Bulan arsip').selectOption('11');await page.getByText(currency(current.total),{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/november-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await region.getByLabel('Cari penerima sistem lama').fill(first.name);assert.equal(await region.locator('tbody tr').count(),1);
  await region.getByRole('button',{name:`Rincian sumber ${first.name}`,exact:true}).click();await page.getByRole('dialog').waitFor();
  assert.ok((await page.getByRole('dialog').boundingBox()).height<=844);await page.screenshot({path:out+'/rincian-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS finance login, 18-coach source totals, modal details, August manual column ignored, historical period filter, three December versions without double counting, mobile overflow and no JS errors.');
}finally{await browser.close();}
