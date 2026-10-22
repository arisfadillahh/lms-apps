#!/usr/bin/env node
// Installs only inside the given LMS runtime directory; never replaces system Node.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const manifest = JSON.parse(await fs.readFile(new URL('./node-runtime.json', import.meta.url), 'utf8'));
if ((await fs.readFile(new URL('../.node-version', import.meta.url), 'utf8')).trim() !== manifest.version) throw new Error('Repository Node pin does not match runtime manifest');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function verifyChecksum(bytes, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected) || sha256(bytes) !== expected) throw new Error('Runtime checksum mismatch');
}

export function verifySignedChecksumList(text, filename, expected) {
  const matches = text.split(/\r?\n/).filter(line => line.endsWith(`  ${filename}`));
  if (matches.length !== 1 || matches[0] !== `${expected}  ${filename}`) throw new Error('Signed archive checksum mismatch');
}

export function verifyArchiveEntries(text, directory) {
  const entries = text.trim().split(/\r?\n/);
  if (!text.trim() || entries.some(entry => (entry !== `${directory}/` && !entry.startsWith(`${directory}/`)) || entry.split('/').includes('..') || entry.includes('\\'))) {
    throw new Error('Unsafe runtime archive entries');
  }
}

async function download(url, limit, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !['nodejs.org', 'raw.githubusercontent.com'].includes(parsed.hostname)) throw new Error('Untrusted runtime source');
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  if (!response.ok || !response.body) throw new Error(`Runtime download HTTP ${response.status}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > limit) throw new Error('Runtime download exceeds size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function verifyInstalledRuntime(directory, expectedArchive, run = execFileSync) {
  const node = path.join(directory, 'bin/node');
  const metadata = JSON.parse(await fs.readFile(path.join(directory, '.lms-runtime.json'), 'utf8'));
  if ((await fs.lstat(directory)).isSymbolicLink() || metadata.version !== manifest.version || metadata.archiveSha256 !== expectedArchive) throw new Error('Unverified existing runtime');
  for (const file of ['bin/node', 'lib/node_modules/npm/bin/npm-cli.js']) {
    verifyChecksum(await fs.readFile(path.join(directory, file)), metadata.files?.[file] || '');
  }
  if (String(run(node, ['--version'], { encoding: 'utf8', timeout: 15000 })).trim() !== `v${manifest.version}`) throw new Error('Installed Node version mismatch');
  return directory;
}

export async function installRuntime({ root, platform = process.platform, arch = process.arch, fetchImpl = globalThis.fetch, run = execFileSync }) {
  if (!root || !path.isAbsolute(root) || path.parse(root).root === path.resolve(root)) throw new Error('An explicit, non-root runtime directory is required');
  root = path.resolve(root);
  const expected = manifest.archives[`${platform}-${arch}`];
  if (!expected) throw new Error('Unsupported Node runtime platform/architecture');
  await fs.mkdir(root, { recursive: true, mode: 0o755 });
  if ((await fs.lstat(root)).isSymbolicLink()) throw new Error('Runtime directory cannot be a symlink');
  const name = `node-v${manifest.version}-${platform}-${arch}`, directory = path.join(root, name), filename = `${name}.tar.xz`;
  try {
    await fs.lstat(directory);
    return await verifyInstalledRuntime(directory, expected, run);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // A partial existing directory is not safe to replace or repair implicitly.
    try { await fs.lstat(directory); throw new Error('Incomplete existing runtime; preserve for investigation'); } catch (check) { if (check.code !== 'ENOENT') throw check; }
  }
  const temporary = await fs.mkdtemp(path.join(root, '.node-install-'));
  try {
    const keyringUrl = `https://raw.githubusercontent.com/nodejs/release-keys/${manifest.keyringCommit}/gpg/pubring.kbx`;
    const base = `https://nodejs.org/dist/v${manifest.version}`;
    const [keyring, signed] = await Promise.all([
      download(keyringUrl, 256000, fetchImpl), download(`${base}/SHASUMS256.txt.asc`, 64000, fetchImpl),
    ]);
    verifyChecksum(keyring, manifest.keyringSha256);
    const keyFile = path.join(temporary, 'pubring.kbx'), signedFile = path.join(temporary, 'SHASUMS256.txt.asc'), checksumsFile = path.join(temporary, 'SHASUMS256.txt');
    await fs.writeFile(keyFile, keyring, { mode: 0o600 });
    await fs.writeFile(signedFile, signed, { mode: 0o600 });
    const status = String(run('gpgv', ['--status-fd=1', '--keyring', keyFile, '--output', checksumsFile, signedFile], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 }));
    if (!status.split('\n').some(line => line.startsWith('[GNUPG:] VALIDSIG ') && line.split(' ').includes(manifest.signer))) throw new Error('Unexpected Node release signer');
    verifySignedChecksumList(await fs.readFile(checksumsFile, 'utf8'), filename, expected);
    const archive = await download(`${base}/${filename}`, 100 * 1024 * 1024, fetchImpl);
    verifyChecksum(archive, expected);
    const archiveFile = path.join(temporary, filename);
    await fs.writeFile(archiveFile, archive, { mode: 0o600 });
    verifyArchiveEntries(String(run('tar', ['-tJf', archiveFile], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30000 })), name);
    run('tar', ['-xJf', archiveFile, '-C', temporary], { stdio: 'pipe', timeout: 60000 });
    const extracted = path.join(temporary, name), files = {};
    for (const file of ['bin/node', 'lib/node_modules/npm/bin/npm-cli.js']) files[file] = sha256(await fs.readFile(path.join(extracted, file)));
    await fs.writeFile(path.join(extracted, '.lms-runtime.json'), JSON.stringify({ version: manifest.version, archiveSha256: expected, files }), { mode: 0o600 });
    await verifyInstalledRuntime(extracted, expected, run);
    await fs.rename(extracted, directory);
    return directory;
  } finally {
    // Only our mkdtemp child is disposable, never the runtime root or another install.
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await installRuntime({ root: process.argv[2] })); }
  catch (error) { console.error(`Node provisioning refused: ${error.message}`); process.exitCode = 1; }
}
