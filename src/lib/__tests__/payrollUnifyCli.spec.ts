import { it, expect } from 'vitest';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPeriod } from '@/lib/payroll/model';
const execute=promisify(execFile);
it('checks the actual persisted JSON and a repeated apply performs no further commits', async () => {
  const directory=await mkdtemp(path.join(os.tmpdir(),'payroll-unify-'));
  let commits=0;
  const document={...createPeriod(2026,11),legacy_imports:[{schema:1,sourceId:'sheet',period:'2026-11',sourceCreatedAt:'2026-01-01T00:00:00Z',sourceModifiedAt:'2026-11-05T00:00:00Z',capturedAt:'2026-11-05T00:00:00Z',rows:[{sourceId:'row',counters:[{label:'Absen Trial',value:1}],fees:[{label:'Fee Trial',value:25000}],total:25000}]}],legacy_links:{row:{status:'LINKED',profile_id:'p',user_id:'u',kind:'COACH',name:'Example Coach'}}};
  const record={id:document.id,revision:1,document};
  const server=createServer(async(request,response)=>{
    const url=new URL(request.url!,'http://localhost');response.setHeader('Content-Type','application/json');
    if(request.method==='POST'){
      const chunks=[];for await(const chunk of request)chunks.push(chunk);
      const body=JSON.parse(Buffer.concat(chunks).toString());expect(body.p_expected_revision).toBe(record.revision);
      record.document=body.p_document;record.revision++;commits++;response.end(JSON.stringify(record.revision));return;
    }
    const table=url.pathname.split('/').at(-1);
    const rows=table==='payroll_profiles'?[{id:'p',user_id:'u',kind:'COACH',name:'Example Coach',job_title:'Coach',active:true}]:table==='payroll_terms'?[{profile_id:'p',contract:'MITRA',base_salary:0,effective_from:'2026-01-01'}]:table==='payroll_settings'?[{automation_enabled:false,active_from:null}]:table==='payroll_periods'?[record]:[];
    response.end(JSON.stringify(rows));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw Error('Local server unavailable');
  const envFile=path.join(directory,'local.env');await writeFile(envFile,`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${address.port}\nSUPABASE_SERVICE_ROLE_KEY=local-only\n`);
  try{
    const args=[path.join(process.cwd(),'scripts/unify-payroll-periods.mjs'),'--env',envFile,'--apply','--backup-dir',path.join(directory,'backups')];
    const first=JSON.parse((await execute(process.execPath,args)).stdout);expect(first.results[0].status).toBe('UPDATED');expect(commits).toBe(1);
    expect(record.document.slips[0].total).toBe(25000);expect(record.document.slips[0].lines[0]).not.toHaveProperty('override_reason');
    const second=JSON.parse((await execute(process.execPath,args)).stdout);expect(second.results[0].status).toBe('UNCHANGED');expect(commits).toBe(1);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(directory,{recursive:true,force:true});}
});
