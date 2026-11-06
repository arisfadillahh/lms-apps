#!/usr/bin/env node
// Run with Node 24.22+ on an approved release. Source and backup files stay private.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { parseLegacySheet, mergeLegacySnapshots, latestLegacySnapshot, withoutUnlabelledExtras } from '../src/lib/payroll/legacyImport.ts';
import { currentPeriod as actualCurrentPeriod } from '../src/lib/payroll/model.ts';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const input = option('--input');
const apply = args.includes('--apply');
const currentPeriod = option('--current-period');
const ignoreUnlabelled = args.includes('--ignore-unlabelled-extras');
const currentSync = args.includes('--current-sync');
if (!input || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(currentPeriod ?? '')) throw new Error('Usage: --input private-source.json[.gz] --current-period YYYY-MM [--apply --env /private/.env --backup-dir /private/backups]');
const bytes = await fs.readFile(input);
const bundle = JSON.parse((input.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8'));
if (!Array.isArray(bundle.snapshots) || !bundle.snapshots.length) throw new Error('No source snapshots.');
const groups = new Map();
for (const source of bundle.snapshots) {
  const checksum = createHash('sha256').update(JSON.stringify({cells:source.cells,ignoreUnlabelled})).digest('hex');
  const parsed = parseLegacySheet(source, checksum, source.file.name === 'Sheet otomasi' ? currentPeriod : undefined);
  const snapshot = ignoreUnlabelled ? withoutUnlabelledExtras(parsed) : parsed;
  if (snapshot.period > currentPeriod) throw new Error('Source archive is after the current period.');
  const group = groups.get(snapshot.period) ?? [];
  if (group.some(s => s.sourceId === snapshot.sourceId)) throw new Error('Duplicate source file in input.');
  groups.set(snapshot.period, [...group, snapshot]);
}
const summary = [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([period,snapshots]) => {
  const chosen = latestLegacySnapshot(snapshots);
  return { period, snapshots: snapshots.length, coaches: chosen.rows.length, total: chosen.total, totalBasis: chosen.totalBasis, extraCells: chosen.rows.reduce((n,r)=>n+r.extras.length,0) };
});
if (currentSync && (currentPeriod !== actualCurrentPeriod().id || groups.size !== 1 || !groups.has(currentPeriod))) throw new Error('Current sync is restricted to the actual current payroll period.');
if (!apply) {
  console.log(JSON.stringify({ mode:'DRY_RUN', periods:groups.size, snapshots:bundle.snapshots.length, summary },null,2));
} else {
  const envFile = option('--env'), backupRoot = option('--backup-dir');
  if (!envFile || !backupRoot || !path.isAbsolute(backupRoot)) throw new Error('Apply requires an explicit environment file and absolute private backup directory.');
  const env = Object.fromEntries((await fs.readFile(envFile,'utf8')).split('\n').filter(l=>l.includes('=')&&!l.trimStart().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
  const base = new URL('/rest/v1/',env.NEXT_PUBLIC_SUPABASE_URL);
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Server database credential unavailable.');
  async function request(resource,method='GET',body,prefer) {
    const response=await fetch(new URL(resource,base),{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body?{body:JSON.stringify(body)}:{})});
    if(!response.ok) throw new Error(`Database ${method} ${resource.split('?')[0]} failed: HTTP ${response.status}`);
    return response.status===204?null:response.json();
  }
  async function assertDeliverySettings() {
    const [settings]=await request('payroll_settings?select=automation_enabled,active_from&id=eq.1');
    if(!settings || (settings.automation_enabled!==false && !currentSync)) throw new Error('Payroll automation must stay disabled throughout archive import.');
    return settings;
  }
  const settings=await assertDeliverySettings();
  const before=await request('payroll_periods?select=*&order=id');
  process.umask(0o077);
  const backupDir=path.join(backupRoot,new Date().toISOString().replaceAll(':','-'));
  await fs.mkdir(backupDir,{recursive:true,mode:0o700});
  await fs.writeFile(path.join(backupDir,'periods-before.json.gz'),gzipSync(JSON.stringify({settings,periods:before})),{mode:0o600,flag:'wx'});
  const results=[];
  for(const [id,snapshots] of [...groups].sort(([a],[b])=>a.localeCompare(b))) {
    await assertDeliverySettings();
    let [record]=await request(`payroll_periods?select=*&id=eq.${id}`);
    if(!record) {
      const [year,month]=id.split('-').map(Number);
      const document={id,year,month,starts_at:new Date(Date.UTC(year,month-2,26,-7)).toISOString(),ends_at:new Date(Date.UTC(year,month-1,26,-7)).toISOString(),correction_deadline:new Date(Date.UTC(year,month-1,25,10)).toISOString(),status:'DRAFT',version:1,slips:[],warnings:[],overrides:{},manual:[],activities:[],transfers:[],deliveries:{},history:[],calculated_at:null};
      await request('payroll_periods?on_conflict=id','POST',{id,revision:0,document},'resolution=ignore-duplicates,return=representation');
      [record]=await request(`payroll_periods?select=*&id=eq.${id}`);
    }
    const document=mergeLegacySnapshots(record.document,snapshots);
    if(Object.values(record.document.deliveries??{}).some(d=>d.status==='SENDING'))throw new Error('Payroll delivery is in progress; retry synchronization later.');
    if(JSON.stringify(document)===JSON.stringify(record.document)){results.push({period:id,status:'UNCHANGED'});continue;}
    if(record.document.status==='FINAL')throw new Error(`Period ${id} is final. Reopen an audited revision before refreshing its source.`);
    await request('rpc/payroll_commit_period','POST',{p_id:id,p_expected_revision:record.revision,p_document:document,p_actor_id:null,p_action:'IMPORT_N8N_ARCHIVE',p_reason:'User-authorized legacy payroll import; source remains authoritative, no payment or delivery changes.'});
    const [saved]=await request(`payroll_periods?select=*&id=eq.${id}`);
    for(const snapshot of snapshots){const actual=saved.document.legacy_imports.find(s=>s.sourceId===snapshot.sourceId);if(actual?.checksum!==snapshot.checksum || actual.total!==snapshot.total || actual.rows.length!==snapshot.rows.length)throw new Error(`Import readback mismatch: ${id}`);}
    for(const field of Object.keys(record.document).filter(k=>k!=='legacy_imports')) {
      // Compare recursively independent of Postgres jsonb object key order.
      const canonical=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
      if(JSON.stringify(canonical(saved.document[field]))!==JSON.stringify(canonical(record.document[field]))) throw new Error(`Existing field changed unexpectedly: ${id}/${field}`);
    }
    results.push({period:id,status:'IMPORTED',revision:saved.revision});
  }
  const afterSettings=await assertDeliverySettings();
  if(afterSettings.active_from!==settings.active_from || afterSettings.automation_enabled!==settings.automation_enabled)throw new Error('Payroll settings changed during import.');
  console.log(JSON.stringify({mode:'APPLIED',backupDir,periods:groups.size,snapshots:bundle.snapshots.length,summary,results,automationEnabled:settings.automation_enabled},null,2));
}
