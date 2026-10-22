import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repository = process.cwd(), target = 'a'.repeat(40), previous = 'b'.repeat(40), temporary = [];
async function executable(file, code) { await fs.writeFile(file, `#!${process.execPath}\n${code}\n`, { mode: 0o755 }); }
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });

async function fixture(patch = {}) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'lms-deploy-behavior-')); temporary.push(root);
  const bin = path.join(root, 'mock-bin'), runtime = path.join(root, 'runtimes/node-patched'), candidate = path.join(root, 'releases', target), old = path.join(root, 'releases', previous);
  for (const dir of [bin, runtime + '/bin', candidate + '/scripts', old, root + '/shared/.data', root + '/shared/baileys_auth_info', root + '/deploy-repo.git']) await fs.mkdir(dir, { recursive: true });
  // Only disposable synthetic fixtures. No application environment or credentials.
  await fs.writeFile(root + '/shared/.env', '# synthetic deployment fixture\n');
  await fs.writeFile(root + '/shared/.data/marker', 'billing state unchanged');
  await fs.writeFile(root + '/shared/baileys_auth_info/marker', 'session unchanged');
  await fs.writeFile(candidate + '/.node-version', '24.22.1\n');
  await fs.writeFile(old + '/.node-version', '24.15.0\n');
  await fs.copyFile(repository + '/scripts/check-pm2-runtime.mjs', candidate + '/scripts/check-pm2-runtime.mjs');
  await fs.symlink(old, root + '/current');
  const preamble = `const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');const args=process.argv.slice(2);const event=s=>fs.appendFileSync(process.env.MOCK_TRACE,s+'\\n');`;
  await executable(bin + '/git', preamble + `if(args.includes('rev-parse'))console.log(process.env.MOCK_TARGET);if(args.includes('status')&&process.env.MOCK_DIRTY)console.log(process.env.MOCK_DIRTY);`);
  await executable(bin + '/node', preamble + `if(args[0]?.endsWith('provision-node-runtime.mjs')){event('provision');console.log(process.env.MOCK_RUNTIME);}else{const r=cp.spawnSync(process.env.MOCK_REAL_NODE,args,{stdio:'inherit'});process.exit(r.status??1);}`);
  await executable(runtime + '/bin/npm', preamble + `event('npm '+args.join(' '));if(args[0]==='run'&&args[1]==='build'&&process.env.MOCK_BUILD_FAIL==='1')process.exit(1);`);
  await executable(runtime + '/bin/node', preamble + `
    if(args[0]?.endsWith('production-healthcheck.mjs')){
      const current=fs.realpathSync(process.env.LMS_DEPLOY_ROOT+'/current');event('health '+args[1]);
      if(args[1].includes(':3010')){try{const pid=fs.readFileSync(process.env.LMS_DEPLOY_ROOT+'/deploy-logs/smoke-'+process.env.MOCK_TARGET+'.pid','utf8').trim();const cwd=fs.readlinkSync('/proc/'+pid+'/cwd');if(!fs.readFileSync(process.env.MOCK_TRACE,'utf8').includes('smoke '+cwd))process.exit(1);}catch{process.exit(1);}}
      if(process.env.MOCK_CANDIDATE_FAIL==='1'&&args[1].includes(':3010'))process.exit(1);
      if(process.env.MOCK_POST_FAIL==='1'&&current.endsWith(process.env.MOCK_TARGET)&&args[1].includes(':3005'))process.exit(1);
    }else if(args[0]?.includes('next/dist/bin/next')){
      event('smoke '+process.cwd());const child=cp.spawn('/bin/sleep',['120'],{stdio:'ignore'});
      process.on('SIGTERM',()=>{child.kill();process.exit(0);});child.on('exit',()=>process.exit(0));
    }else{const r=cp.spawnSync(process.env.MOCK_REAL_NODE,args,{stdio:'inherit'});process.exit(r.status??1);}
  `);
  await executable(bin + '/pm2', preamble + `
    const current=fs.realpathSync(process.env.LMS_DEPLOY_ROOT+'/current');
    if(args[0]==='jlist')console.log(JSON.stringify([{name:'lms',pid:42,pm2_env:{status:'online',node_version:process.env.MOCK_WRONG_NODE==='1'&&current.endsWith(process.env.MOCK_TARGET)?'24.15.0':'24.22.1',exec_interpreter:process.env.MOCK_RUNTIME+'/bin/node',pm_cwd:current}}]));
    else event('pm2 '+args.join(' ')+' auth='+(process.env.WHATSAPP_AUTH_DIR||'')+' cwd='+current);
  `);
  await executable(bin + '/flock', preamble + `event('lock');if(process.env.MOCK_LOCK_BUSY==='1')process.exit(1);`);
  await executable(bin + '/ss', '');
  await executable(bin + '/sleep', '');
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH, LMS_DEPLOY_ROOT: root, MOCK_TARGET: target, MOCK_RUNTIME: runtime, MOCK_REAL_NODE: process.execPath, MOCK_TRACE: root + '/events', ...patch };
  // Map only the fixed host lock pathname into this disposable filesystem.
  // Production's mandatory lock remains fixed; every workflow operation is unchanged.
  const script = (await fs.readFile(repository + '/scripts/deploy-production.sh', 'utf8')).replace('/var/lock/lms-production-deploy.lock', root + '/deploy.lock');
  await fs.writeFile(root + '/deploy-test.sh', script);
  const result = spawnSync('bash', [root + '/deploy-test.sh', target], { env, encoding: 'utf8', timeout: 35000, maxBuffer: 1024 * 1024 });
  const trace = await fs.readFile(root + '/events', 'utf8').catch(() => '');
  return { root, runtime, candidate, old, result, trace, current: await fs.realpath(root + '/current') };
}

describe('actual deployment script with isolated fake services', () => {
  it('builds before switching, launches only LMS with explicit patched interpreter and preserves shared data', async () => {
    const f = await fixture();
    expect(f.result.status, f.result.stderr).toBe(0);
    expect(f.current).toBe(f.candidate);
    expect(f.trace.indexOf('npm run build')).toBeLessThan(f.trace.indexOf('pm2 delete'));
    expect(f.trace.includes('smoke ' + f.old)).toBe(true);
    expect(f.trace.includes('--interpreter ' + f.runtime + '/bin/node')).toBe(true);
    expect(f.trace.includes('auth=' + f.root + '/shared/baileys_auth_info')).toBe(true);
    expect(f.trace.includes('pm2 update') || f.trace.includes('pm2 restart all')).toBe(false);
    expect(await fs.readFile(f.root + '/shared/deployed-node-version', 'utf8')).toBe('24.22.1\n');
    expect(await fs.readFile(f.root + '/shared/.data/marker', 'utf8')).toBe('billing state unchanged');
    expect(await fs.readFile(f.root + '/shared/baileys_auth_info/marker', 'utf8')).toBe('session unchanged');
  }, 40000);
  it.each([{ MOCK_BUILD_FAIL: '1' }, { MOCK_CANDIDATE_FAIL: '1' }])('keeps the active release and PM2 untouched on pre-switch failure %j', async patch => {
    const f = await fixture(patch);
    expect(f.result.status).toBe(patch.MOCK_BUILD_FAIL ? 1 : 5);
    expect(f.current).toBe(f.old);
    expect(f.trace.includes('npm run build')).toBe(true);
    expect(f.trace.includes('pm2 delete')).toBe(false);
    expect(await fs.readFile(f.root + '/shared/.data/marker', 'utf8')).toBe('billing state unchanged');
  }, 40000);
  it.each([{ MOCK_POST_FAIL: '1' }, { MOCK_WRONG_NODE: '1' }])('rolls back application but keeps patched runtime after failed production verification %j', async patch => {
    const f = await fixture(patch);
    expect(f.result.status).toBe(8);
    expect(f.current).toBe(f.old);
    const starts = f.trace.split('\n').filter(line => line.startsWith('pm2 start'));
    expect(starts).toHaveLength(2);
    expect(starts.every(line => line.includes('--interpreter ' + f.runtime + '/bin/node'))).toBe(true);
    expect(starts[1].endsWith('cwd=' + f.old)).toBe(true);
    expect(await fs.readFile(f.root + '/shared/baileys_auth_info/marker', 'utf8')).toBe('session unchanged');
  }, 40000);
  it.each([{ MOCK_DIRTY: ' M src/page.tsx' }, { MOCK_DIRTY: '?? unexpected-source.js' }, { MOCK_LOCK_BUSY: '1' }])('refuses local modifications or concurrent deployment before build %j', async patch => {
    const f = await fixture(patch);
    expect(f.result.status).toBe(patch.MOCK_LOCK_BUSY ? 75 : 3);
    expect(f.current).toBe(f.old);
    expect(f.trace.includes('provision') || f.trace.includes('npm ') || f.trace.includes('pm2 delete')).toBe(false);
  }, 40000);
});
