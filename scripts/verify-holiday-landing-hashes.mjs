// Read-only: no SSH, local writes, uploads, restarts or deployment actions.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const baseline={
  'index.html':'d936521cd7a1281668b79a84f1bf57be01b0a0d960504ec3a498332d6ca8f7d9',
  'registration-v5.js':'be5b8297f1cb7ddace16bf4d60480630ca5b391f64c3f063b6b5da53dc7cffe7',
  'meta-tracking-v2.js':'71571231ac04b305708a9cbd8917499d55d54333849f4f3d23e906f8c1e416ee',
};
export async function compareHolidayLanding(base,{baselineOnly=false,request=fetch,root=path.join(process.cwd(),'ops/holiday-landing')}={}) {
  const url=new URL(base);
  if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Use an HTTPS landing directory URL, without credentials, query or fragment.');
  if(!url.pathname.endsWith('/'))url.pathname+='/';
  const html=await fs.readFile(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+)["']/g)].map(m=>m[1]);
  if(scripts.some(s=>!/^[-a-zA-Z0-9.]+\.js$/.test(s)))throw Error('Invalid local script reference');
  const files=baselineOnly?Object.keys(baseline):['index.html',...new Set(scripts)];
  const results=[];
  for(const file of files) {
    const expected=baselineOnly?baseline[file]:hash(await fs.readFile(path.join(root,file)));
    const response=await request(new URL(file,url),{method:'GET',headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(15000)});
    const actual=response.ok?hash(Buffer.from(await response.arrayBuffer())):null;
    results.push({file,status:response.status,expected,actual,match:actual===expected});
  }
  return {mode:baselineOnly?'captured-baseline':'local-candidate',match:results.every(r=>r.match),results};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const url=process.argv.slice(2).find(x=>!x.startsWith('--'));
  if(!url)console.log('Usage: node scripts/verify-holiday-landing-hashes.mjs <https://host/holiday-class/> [--baseline]. Read-only; mismatch exits 2.');
  else compareHolidayLanding(url,{baselineOnly:process.argv.includes('--baseline')}).then(result=>{console.log(JSON.stringify(result,null,2));if(!result.match)process.exitCode=2;}).catch(()=>{console.error('Read-only landing hash verification failed. Check URL, redirects and availability. No files were modified.');process.exitCode=1;});
}
