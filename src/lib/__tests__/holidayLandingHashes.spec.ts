import {readFileSync} from 'node:fs';
import path from 'node:path';
import {describe,expect,it,vi} from 'vitest';
import {compareHolidayLanding} from '../../../scripts/verify-holiday-landing-hashes.mjs';
describe('read-only landing hash verification',()=>{
  it('compares served bytes against every local active script',async()=>{
    const request=vi.fn(async(input:Parameters<typeof fetch>[0])=>{
      const url=new URL(input instanceof Request?input.url:String(input));
      return new Response(readFileSync(path.join(process.cwd(),'ops/holiday-landing',path.basename(url.pathname))));
    });
    const r=await compareHolidayLanding('https://example.test/holiday-class/',{request});
    expect(r.match).toBe(true);expect(r.results.some((f:{file:string})=>f.file==='registration-v6.js')).toBe(true);
    expect(request.mock.calls.every((call:unknown[])=>String(call[0]).startsWith('https://example.test/holiday-class/'))).toBe(true);
  });
  it('reports mismatched bytes and missing files rather than publishing anything',async()=>{
    const request=vi.fn(async()=>new Response('old version'));
    expect((await compareHolidayLanding('https://example.test/holiday-class/',{request})).match).toBe(false);
    expect((await compareHolidayLanding('https://example.test/holiday-class/',{request:async()=>new Response('',{status:404})})).match).toBe(false);
  });
  it('rejects URLs containing secrets or an unencrypted remote host',async()=>{
    for(const url of ['https://user:pass@example.test/','https://example.test/?token=test','http://example.test/'])await expect(compareHolidayLanding(url)).rejects.toThrow();
  });
});
