import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { currentPeriod } from '@/lib/payroll/model';
const execute=promisify(execFile);
it('allows only an explicit current-period source refresh while WA is active and preserves delivery settings',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'payroll-current-import-'));
  const document=currentPeriod();const record={id:document.id,revision:1,document};let commits=0;
  const settings={automation_enabled:true,active_from:'2026-10-26'};
  const server=createServer(async(request,response)=>{
    response.setHeader('Content-Type','application/json');const url=new URL(request.url!,'http://localhost');
    if(request.method==='POST'){
      const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
      expect(url.pathname).toBe('/rest/v1/rpc/payroll_commit_period');expect(body.p_expected_revision).toBe(record.revision);record.document=body.p_document;record.revision++;commits++;response.end(JSON.stringify(record.revision));return;
    }
    response.end(JSON.stringify(url.pathname.endsWith('payroll_settings')?[settings]:[record]));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('Server unavailable');
  const envFile=path.join(directory,'local.env'),input=path.join(directory,'source.json');
  await writeFile(envFile,`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${address.port}\nSUPABASE_SERVICE_ROLE_KEY=local-only\n`);
  const rows=[['Coach ID','Name','Username','Absen Trial','Fee Trial','Total Estimasi'],[123,'Synthetic Coach','@synthetic',1,25000,25000]];
  await writeFile(input,JSON.stringify({snapshots:[{file:{id:'synthetic',name:'Sheet otomasi',createdTime:'2026-01-01T00:00:00Z',modifiedTime:new Date().toISOString()},capturedAt:new Date().toISOString(),cells:{spreadsheetId:'synthetic',sheets:[{properties:{title:'ID Coaches'},data:[{rowData:rows.map(row=>({values:row.map(value=>({effectiveValue:typeof value==='number'?{numberValue:value}:{stringValue:value}}))}))}]}]}}]}));
  const args=[path.join(process.cwd(),'scripts/import-payroll-legacy.mjs'),'--input',input,'--current-period',document.id,'--apply','--env',envFile,'--backup-dir',path.join(directory,'backups')];
  try{
    await expect(execute(process.execPath,args)).rejects.toThrow(/disabled/);expect(commits).toBe(0);
    const first=JSON.parse((await execute(process.execPath,[...args,'--current-sync'])).stdout);expect(first.automationEnabled).toBe(true);expect(first.results[0].status).toBe('IMPORTED');expect(commits).toBe(1);expect(settings).toEqual({automation_enabled:true,active_from:'2026-10-26'});
    const second=JSON.parse((await execute(process.execPath,[...args,'--current-sync'])).stdout);expect(second.results[0].status).toBe('UNCHANGED');expect(commits).toBe(1);
    const archiveArgs=[...args,'--current-sync'];archiveArgs[archiveArgs.indexOf('--current-period')+1]='2025-01';
    await expect(execute(process.execPath,archiveArgs)).rejects.toThrow(/actual current/);expect(commits).toBe(1);
    record.document.deliveries.x={status:'SENDING'} as never;
    await expect(execute(process.execPath,[...args,'--current-sync'])).rejects.toThrow(/delivery is in progress/);expect(commits).toBe(1);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(directory,{recursive:true,force:true});}
});
