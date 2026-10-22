import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { installRuntime, manifest, verifyChecksum, verifyArchiveEntries, verifySignedChecksumList } from '../../../scripts/provision-node-runtime.mjs';
import { checkHealth } from '../../../scripts/production-healthcheck.mjs';
import { validatePm2Runtime } from '../../../scripts/check-pm2-runtime.mjs';

const temporary = [];
const hash = value => createHash('sha256').update(value).digest('hex');
async function temp() { const dir = await mkdtemp(path.join(tmpdir(), 'lms-runtime-test-')); temporary.push(dir); return dir; }
afterEach(async () => { await Promise.all(temporary.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

describe('verified app-private Node runtime', () => {
  it('rejects corrupted bytes, wrong signed filenames, duplicate checksum entries and traversal', () => {
    const bytes = Buffer.from('official fixture'), digest = hash(bytes), name = 'node-v24.22.1-linux-x64.tar.xz';
    expect(() => verifyChecksum(bytes, digest)).not.toThrow();
    expect(() => verifyChecksum(Buffer.from('modified'), digest)).toThrow();
    expect(() => verifySignedChecksumList(`${digest}  ${name}\n`, name, digest)).not.toThrow();
    expect(() => verifySignedChecksumList(`${digest}  other.tar.xz`, name, digest)).toThrow();
    expect(() => verifySignedChecksumList(`${digest}  ${name}\n${digest}  ${name}`, name, digest)).toThrow();
    expect(() => verifyArchiveEntries('node-v24.22.1-linux-x64/\nnode-v24.22.1-linux-x64/bin/node\n', 'node-v24.22.1-linux-x64')).not.toThrow();
    for (const entries of ['', '/bin/node', 'other/bin/node', 'node-v24.22.1-linux-x64/../../etc/passwd']) expect(() => verifyArchiveEntries(entries, 'node-v24.22.1-linux-x64')).toThrow();
  });
  it('refuses unsupported or broad roots before fetching or running installers', async () => {
    const fetchImpl = vi.fn();
    for (const root of ['/', '', 'relative']) await expect(installRuntime({ root, fetchImpl })).rejects.toThrow();
    await expect(installRuntime({ root: await temp(), platform: 'untrusted', fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('rejects an altered signing keyring before archive fetch or execution', async () => {
    const run = vi.fn(), fetchImpl = vi.fn(async () => new Response('corrupted keyring'));
    await expect(installRuntime({ root: await temp(), platform: 'linux', arch: 'x64', fetchImpl, run })).rejects.toThrow('checksum');
    expect(run).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls).toHaveLength(2);
    expect(fetchImpl.mock.calls.every(([url]) => !url.endsWith('.tar.xz'))).toBe(true);
  });
  it('reuses an intact verified runtime but preserves and refuses a modified one', async () => {
    const root = await temp(), directory = path.join(root, `node-v${manifest.version}-linux-x64`), node = '#!/bin/sh\nprintf "%s\\n" "v24.22.1"\n', npm = '// fixture npm cli';
    await mkdir(path.join(directory, 'bin'), { recursive: true });
    await mkdir(path.join(directory, 'lib/node_modules/npm/bin'), { recursive: true });
    await writeFile(path.join(directory, 'bin/node'), node); await chmod(path.join(directory, 'bin/node'), 0o755);
    await writeFile(path.join(directory, 'lib/node_modules/npm/bin/npm-cli.js'), npm);
    await writeFile(path.join(directory, '.lms-runtime.json'), JSON.stringify({ version: manifest.version, archiveSha256: manifest.archives['linux-x64'], files: { 'bin/node': hash(node), 'lib/node_modules/npm/bin/npm-cli.js': hash(npm) } }));
    const fetchImpl = vi.fn();
    expect(await installRuntime({ root, platform: 'linux', arch: 'x64', fetchImpl })).toBe(directory);
    await writeFile(path.join(directory, 'bin/node'), 'modified binary');
    await expect(installRuntime({ root, platform: 'linux', arch: 'x64', fetchImpl })).rejects.toThrow('checksum');
    expect(await readFile(path.join(directory, 'bin/node'), 'utf8')).toBe('modified binary');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('does not overwrite a partial runtime directory', async () => {
    const root = await temp(), directory = path.join(root, `node-v${manifest.version}-linux-x64`);
    await mkdir(directory); await writeFile(path.join(directory, 'evidence'), 'preserve');
    await expect(installRuntime({ root, platform: 'linux', arch: 'x64', fetchImpl: vi.fn() })).rejects.toThrow('Incomplete existing runtime');
    expect(await readFile(path.join(directory, 'evidence'), 'utf8')).toBe('preserve');
  });
});

describe('deployment health and actual PM2 runtime', () => {
  it('consumes every response and checks auth boundaries without creating data', async () => {
    const consumed = [], fetchImpl = vi.fn(async url => {
      const route = url.pathname, status = route === '/login' ? 200 : route.startsWith('/api/') ? 401 : 307;
      return { status, headers: new Headers({ location: '/login' }), arrayBuffer: async () => { consumed.push(route); return new ArrayBuffer(0); } };
    });
    await checkHealth('http://127.0.0.1:3010', { full: true, fetchImpl });
    expect(consumed).toEqual(['/login', '/admin/dashboard', '/coach/dashboard', '/coder/dashboard', '/api/admin/invoice-checkouts']);
    expect(fetchImpl.mock.calls.every(([, init]) => init.redirect === 'manual' && !init.method)).toBe(true);
  });
  it('fails closed on unexpected public access, wrong redirect or untrusted origin', async () => {
    await expect(checkHealth('http://127.0.0.1:3010', { full: true, fetchImpl: async () => new Response('unexpected public content') })).rejects.toThrow();
    const fetchImpl = vi.fn(async url => new Response('', { status: url.pathname === '/login' ? 200 : 307, headers: { location: '/unexpected' } }));
    await expect(checkHealth('http://127.0.0.1:3010', { full: true, fetchImpl })).rejects.toThrow('redirect');
    const noNetwork = vi.fn();
    await expect(checkHealth('https://example.test', { fetchImpl: noNetwork })).rejects.toThrow();
    expect(noNetwork).not.toHaveBeenCalled();
  });
  it('requires online PID, exact interpreter, patched runtime version and release cwd', () => {
    const expected = { name: 'lms', node: '/runtime/bin/node', version: manifest.version, cwd: '/release' };
    const app = { name: 'lms', pid: 42, pm2_env: { status: 'online', node_version: manifest.version, exec_interpreter: expected.node, pm_cwd: expected.cwd } };
    expect(validatePm2Runtime([app], expected)).toBe(true);
    for (const patch of [{ status: 'errored' }, { node_version: '24.15.0' }, { exec_interpreter: '/usr/local/bin/node' }, { pm_cwd: '/old-release' }]) expect(validatePm2Runtime([{ ...app, pm2_env: { ...app.pm2_env, ...patch } }], expected)).toBe(false);
    expect(validatePm2Runtime([{ ...app, pid: 0 }], expected)).toBe(false);
    expect(validatePm2Runtime([], expected)).toBe(false);
  });
});
