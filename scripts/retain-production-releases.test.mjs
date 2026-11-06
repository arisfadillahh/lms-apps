import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { retainProductionReleases } from './retain-production-releases.mjs';

function fixture(t, count = 5) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-retention-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const repo = path.join(root, 'deploy-repo.git');
  const shared = path.join(root, 'shared');
  const releases = path.join(root, 'releases');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  fs.mkdirSync(source);
  fs.mkdirSync(shared);
  fs.mkdirSync(releases);
  git('init', '--quiet', source);
  git('init', '--quiet', '--bare', repo);
  fs.writeFileSync(path.join(source, '.gitignore'), '.next/\nnode_modules/\n.env\n.data\n.uploads\nbaileys_auth_info\npublic/uploads\n');
  const shas = [];
  for (let i = 0; i < count; i++) {
    fs.writeFileSync(path.join(source, 'version.txt'), `${i}\n`);
    git('-C', source, 'add', '.');
    git('-C', source, '-c', 'user.name=Retention test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', `Release ${i}`);
    shas.push(git('-C', source, 'rev-parse', 'HEAD'));
  }
  git(`--git-dir=${repo}`, 'fetch', '--quiet', source, 'HEAD');
  fs.mkdirSync(path.join(shared, 'baileys_auth_info'));
  fs.writeFileSync(path.join(shared, 'baileys_auth_info', 'session'), 'preserve session');
  fs.mkdirSync(path.join(shared, '.data'));
  fs.writeFileSync(path.join(shared, '.data', 'payroll'), 'preserve payroll');
  fs.writeFileSync(path.join(shared, '.env'), 'fixture only');
  for (const sha of shas) {
    const directory = path.join(releases, sha);
    git(`--git-dir=${repo}`, 'worktree', 'add', '--quiet', '--detach', directory, sha);
    fs.mkdirSync(path.join(directory, '.next'));
    fs.writeFileSync(path.join(directory, '.next', 'BUILD_ID'), sha);
    for (const link of ['.env', '.data', 'baileys_auth_info']) {
      fs.symlinkSync(path.join(shared, link), path.join(directory, link));
    }
  }
  const state = path.join(shared, 'release-retention.json');
  const save = successful => fs.writeFileSync(state, JSON.stringify({ version: 1, successful }));
  const activate = index => {
    const current = path.join(root, 'current');
    if (fs.existsSync(current)) fs.unlinkSync(current);
    fs.symlinkSync(path.join(releases, shas[index]), current);
    return {
      root, active: shas[index], previous: path.join(releases, shas[index - 1]),
      apps: [{ name: 'lms', pm2_env: { status: 'online', pm_cwd: path.join(releases, shas[index]) } }],
    };
  };
  return { root, shas, shared, releases, state, save, activate, git, repo };
}

test('dry-run plans by successful deployment order without any filesystem changes', t => {
  const f = fixture(t);
  f.save(f.shas);
  fs.utimesSync(path.join(f.releases, f.shas[0]), new Date(), new Date());
  const before = fs.readFileSync(f.state, 'utf8');
  const result = retainProductionReleases(f.activate(4));
  assert.equal(result.mode, 'dry-run');
  assert.deepEqual(result.keep, f.shas.slice(2));
  assert.deepEqual(result.remove, f.shas.slice(0, 2), JSON.stringify(result));
  assert.equal(fs.readFileSync(f.state, 'utf8'), before);
  assert.equal(fs.readdirSync(f.releases).length, 5);
});

test('apply removes only old registered successful releases and preserves shared sessions/data', t => {
  const f = fixture(t);
  f.save(f.shas);
  fs.mkdirSync(path.join(f.root, 'deploy-backups'));
  fs.writeFileSync(path.join(f.root, 'deploy-backups', 'payroll'), 'preserve backup');
  const result = retainProductionReleases({ ...f.activate(4), apply: true });
  assert.deepEqual(result.removed, f.shas.slice(0, 2));
  assert.deepEqual(fs.readdirSync(f.releases).sort(), f.shas.slice(2).sort());
  assert.equal(fs.readFileSync(path.join(f.shared, 'baileys_auth_info', 'session'), 'utf8'), 'preserve session');
  assert.equal(fs.readFileSync(path.join(f.shared, '.data', 'payroll'), 'utf8'), 'preserve payroll');
  assert.equal(fs.readFileSync(path.join(f.root, 'deploy-backups', 'payroll'), 'utf8'), 'preserve backup');
  assert.equal(f.git(`--git-dir=${f.repo}`, 'worktree', 'list', '--porcelain').includes(f.shas[0]), false);
});

test('first rollout preserves historical unmanaged checkouts; future successes rotate to three', t => {
  const f = fixture(t, 7);
  const first = retainProductionReleases({ ...f.activate(4), apply: true });
  assert.deepEqual(first.removed, []);
  assert.equal(first.unmanaged.length, 5);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.state)).successful, f.shas.slice(3, 5));
  retainProductionReleases({ ...f.activate(5), apply: true });
  const next = retainProductionReleases({ ...f.activate(6), apply: true });
  assert.deepEqual(next.keep, f.shas.slice(4));
  assert.deepEqual(next.removed, [f.shas[3]]);
  for (const sha of f.shas.slice(0, 3)) assert.equal(fs.existsSync(path.join(f.releases, sha)), true);
});

test('tracked changes and unknown local data block deletion', t => {
  const f = fixture(t);
  f.save(f.shas);
  fs.writeFileSync(path.join(f.releases, f.shas[0], 'version.txt'), 'local source change');
  fs.writeFileSync(path.join(f.releases, f.shas[1], 'private-backup'), 'keep');
  const result = retainProductionReleases({ ...f.activate(4), apply: true });
  assert.deepEqual(result.removed, []);
  assert.equal(result.blocked.length, 2);
});

test('real runtime data or a symlink outside shared blocks deletion', t => {
  const f = fixture(t);
  f.save(f.shas);
  const oldData = path.join(f.releases, f.shas[0], '.data');
  fs.unlinkSync(oldData);
  fs.mkdirSync(oldData);
  fs.writeFileSync(path.join(oldData, 'important'), 'keep');
  const wrongLink = path.join(f.releases, f.shas[1], 'baileys_auth_info');
  fs.unlinkSync(wrongLink);
  fs.symlinkSync(f.root, wrongLink);
  const result = retainProductionReleases({ ...f.activate(4), apply: true });
  assert.deepEqual(result.removed, []);
  assert.equal(result.blocked.length, 2);
  assert.equal(fs.existsSync(path.join(oldData, 'important')), true);
});

test('old PM2 executable references are protected even when more than three checkouts remain', t => {
  const f = fixture(t);
  f.save(f.shas);
  const options = f.activate(4);
  options.apps.push({ name: 'other', pm2_env: { status: 'stopped', pm_exec_path: path.join(f.releases, f.shas[0], 'version.txt') } });
  const result = retainProductionReleases({ ...options, apply: true });
  assert.deepEqual(result.removed, [f.shas[1]]);
  assert.equal(result.blocked[0].sha, f.shas[0]);
});

test('mismatched PM2 runtime or malformed state fails closed', t => {
  const f = fixture(t);
  f.save(f.shas);
  const options = f.activate(4);
  options.apps[0].pm2_env.status = 'stopped';
  assert.throws(() => retainProductionReleases({ ...options, apply: true }), /online PM2/);
  fs.writeFileSync(f.state, JSON.stringify({ version: 1, successful: ['../shared'] }));
  assert.throws(() => retainProductionReleases({ ...f.activate(4), apply: true }), /Invalid retention ledger/);
  assert.equal(fs.readdirSync(f.releases).length, 5);
});

test('symlink ledger and release directories are never adopted or removed', t => {
  const f = fixture(t);
  f.save(f.shas);
  const options = f.activate(4);
  fs.renameSync(f.state, `${f.state}.original`);
  fs.symlinkSync(`${f.state}.original`, f.state);
  assert.throws(() => retainProductionReleases({ ...options, apply: true }), /ledger must not be a symlink/);
  fs.unlinkSync(f.state);
  fs.renameSync(`${f.state}.original`, f.state);
  const linkSha = 'f'.repeat(40);
  fs.symlinkSync(f.shared, path.join(f.releases, linkSha));
  const result = retainProductionReleases({ ...options, apply: true });
  assert.equal(result.unmanaged.includes(linkSha), true);
  assert.equal(fs.lstatSync(path.join(f.releases, linkSha)).isSymbolicLink(), true);
});
