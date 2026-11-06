#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { calculateSynchronizedPeriod } from '../src/lib/payroll/synchronizedPeriod.ts';
import { currentPeriod } from '../src/lib/payroll/model.ts';
const args=process.argv.slice(2), option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const envFile=option('--env'),backupRoot=option('--backup-dir'),only=option('--period'),actor=option('--actor')??null,apply=args.includes('--apply');
const currentSync=args.includes('--current-sync');
if(!envFile||(apply&&(!backupRoot||!path.isAbsolute(backupRoot)))||(only&&!/^20\d{2}-(0[1-9]|1[0-2])$/.test(only))||(actor&&!/^[a-f0-9-]{36}$/i.test(actor)))throw new Error('Usage: --env private.env [--period YYYY-MM] [--apply --backup-dir /private/backups]');
const env=Object.fromEntries((await fs.readFile(envFile,'utf8')).split('\n').filter(l=>l.includes('=')&&!l.trimStart().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
const base=new URL('/rest/v1/',env.NEXT_PUBLIC_SUPABASE_URL),key=env.SUPABASE_SERVICE_ROLE_KEY;
if(!key)throw new Error('Database credential unavailable.');
async function request(resource,method='GET',body){const r=await fetch(new URL(resource,base),{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(`Database ${resource.split('?')[0]} failed: HTTP ${r.status}`);return r.status===204?null:r.json();}
const [people,terms,cards,settings,records]=await Promise.all(['payroll_profiles?select=*','payroll_terms?select=*','payroll_rate_cards?select=*','payroll_settings?select=automation_enabled,active_from&id=eq.1',`payroll_periods?select=*&order=id${only?'&id=eq.'+only:''}`].map(q=>request(q)));
const now=new Date(),current=currentPeriod(now).id;
if(currentSync && (only!==current || records.some(r=>r.id!==current)))throw new Error('Current sync is restricted to the actual current payroll period.');
if(!settings[0] || (settings[0].automation_enabled!==false && !currentSync))throw new Error('Payroll delivery must remain disabled during archive migration.');
const plans=records.filter(r=>r.document.legacy_imports?.length&&r.document.status==='DRAFT').map(record=>{
 if(Object.values(record.document.deliveries??{}).some(d=>d.status==='SENDING'))throw new Error('Payroll delivery is in progress; retry synchronization later.');
 // Compare the JSON representation actually stored by Postgres, which omits optional undefined fields.
 const document=JSON.parse(JSON.stringify(calculateSynchronizedPeriod({period:record.document,people,terms,cards,now,includeRecurring:record.id===current})));
 const previous=structuredClone(record.document),comparable=structuredClone(document);delete previous.calculated_at;delete comparable.calculated_at;
 return {record,document,changed:!isDeepStrictEqual(previous,comparable)};
});
let backupDir;
if(apply&&plans.some(p=>p.changed)){
 process.umask(0o077);backupDir=path.join(backupRoot,new Date().toISOString().replaceAll(':','-'));await fs.mkdir(backupDir,{recursive:true,mode:0o700});
 await fs.writeFile(path.join(backupDir,'periods-before.json.gz'),gzipSync(JSON.stringify({people,terms,cards,settings,records})),{flag:'wx',mode:0o600});
}
const results=[];
for(const {record,document,changed} of plans){
 if(apply&&changed){
  await request('rpc/payroll_commit_period','POST',{p_id:record.id,p_expected_revision:record.revision,p_document:document,p_actor_id:actor,p_action:'SYNC_PAYROLL',p_reason:'Unified LMS payroll: synchronized cumulative components replace prior values; operator corrections, transfer records and stored final versions are preserved.'});
  const [saved]=await request(`payroll_periods?select=*&id=eq.${record.id}`);if(!isDeepStrictEqual(saved.document,document))throw new Error('Payroll readback mismatch.');
  for(const field of ['history','transfers','deliveries','manual','activities','overrides','legacy_imports','legacy_links'])if(!isDeepStrictEqual(saved.document[field],record.document[field]))throw new Error('Protected payroll field changed.');
 }
 results.push({period:record.id,status:changed?(apply?'UPDATED':'PLANNED'):'UNCHANGED',recipients:document.slips.length,total:document.slips.reduce((n,s)=>n+s.total,0),warnings:document.warnings.length});
}
if(!isDeepStrictEqual(await request('payroll_settings?select=automation_enabled,active_from&id=eq.1'),settings))throw new Error('Payroll settings changed concurrently.');
console.log(JSON.stringify({mode:apply?'APPLIED':'DRY_RUN',backupDir,results,automationEnabled:settings[0]?.automation_enabled}));
