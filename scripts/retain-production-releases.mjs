#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const ROLLBACK_COUNT = 2;
const RUNTIME_LINKS = {
  '.env': '.env',
  '.data': '.data',
  '.uploads': '.uploads',
  baileys_auth_info: 'baileys_auth_info',
  'public/uploads': 'public-uploads',
};

function git(repo, args) {
  return execFileSync('git', [`--git-dir=${repo}`, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function isInside(target, parent) {
  return target === parent || target.startsWith(`${parent}${path.sep}`);
}

function worktrees(repo) {
  return new Map(git(repo, ['worktree', 'list', '--porcelain']).trim().split('\n\n').map(block => {
    const lines = block.split('\n');
    return [lines.find(line => line.startsWith('worktree '))?.slice(9), lines.find(line => line.startsWith('HEAD '))?.slice(5)];
  }));
}

function processPaths(apps) {
  const paths = apps.flatMap(app => [app.pm2_env?.pm_cwd, app.pm2_env?.pm_exec_path]).filter(Boolean);
  // Include non-PM2 processes that may still be using an older checkout.
  if (process.platform === 'linux') {
    for (const entry of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue;
      for (const link of ['cwd', 'exe']) {
        try { paths.push(fs.realpathSync(`/proc/${entry}/${link}`)); } catch { /* Process exited or is inaccessible. */ }
      }
    }
  }
  return paths.map(value => {
    try { return fs.realpathSync(value); } catch { return path.resolve(value); }
  });
}

function validateDirectory(target) {
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) {
    throw new Error(`Expected a real directory: ${target}`);
  }
}

function unsafeContents(directory, shared) {
  const generated = path.join(directory, 'next-env.d.ts');
  if (fs.existsSync(generated)) {
    const stat = fs.lstatSync(generated);
    const lines = fs.readFileSync(generated, 'utf8').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const allowed = new Set(['/// <reference types="next" />', '/// <reference types="next/image-types/global" />', '// NOTE: This file should not be edited', '// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.']);
    if (!stat.isFile() || stat.isSymbolicLink() || !lines.includes('/// <reference types="next" />') || !lines.includes('/// <reference types="next/image-types/global" />') || lines.some(line => !allowed.has(line) && !/^import "\.\/\.next\/(dev\/)?types\/(routes|root-params)\.d\.ts";$/.test(line))) return 'Unexpected contents in generated next-env.d.ts';
  }
  for (const [relative, sharedName] of Object.entries(RUNTIME_LINKS)) {
    const target = path.join(directory, relative);
    let stat;
    try { stat = fs.lstatSync(target); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    let destination;
    try { destination = fs.realpathSync(target); } catch { destination = path.resolve(path.dirname(target), fs.readlinkSync(target)); }
    if (!stat.isSymbolicLink() || destination !== path.join(shared, sharedName)) {
      return `Runtime data is not a shared symlink: ${relative}`;
    }
  }
  const statuses = execFileSync('git', ['-C', directory, 'status', '--porcelain=v1', '-z', '--ignored'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).split('\0').filter(Boolean);
  const allowed = new Set(['.next/', 'node_modules/', 'tsconfig.tsbuildinfo', 'next-env.d.ts', ...Object.keys(RUNTIME_LINKS)]);
  for (const status of statuses) {
    if (!['??', '!!'].includes(status.slice(0, 2))) return 'Tracked source has local changes';
    if (!allowed.has(status.slice(3).replace(/\/$/, '')) && !allowed.has(status.slice(3))) {
      return `Unexpected local content: ${status.slice(3)}`;
    }
  }
  return null;
}

/** Called only after deploy health checks, while deploy-production.sh holds its lock. */
export function retainProductionReleases({ root, active, previous, apps, appName = 'lms', apply = false }) {
  if (!SHA.test(active)) throw new Error('An exact active commit SHA is required');
  root = fs.realpathSync(root);
  const releases = path.join(root, 'releases');
  const shared = path.join(root, 'shared');
  validateDirectory(releases);
  validateDirectory(shared);
  const repo = process.env.LMS_DEPLOY_REPO || path.join(root, 'deploy-repo.git');
  const registered = worktrees(repo);
  const validRelease = sha => {
    if (!SHA.test(sha)) return false;
    const target = path.join(releases, sha);
    try { validateDirectory(target); } catch { return false; }
    return registered.get(target) === sha;
  };
  const activePath = path.join(releases, active);
  if (!validRelease(active) || fs.realpathSync(path.join(root, 'current')) !== activePath) {
    throw new Error('Active checkout/current symlink does not match the successful commit');
  }
  if (!Array.isArray(apps) || !apps.some(app => app.name === appName && app.pm2_env?.status === 'online'
    && fs.realpathSync(app.pm2_env.pm_cwd) === activePath)) {
    throw new Error('An online PM2 app must be running the active checkout');
  }

  const statePath = path.join(shared, 'release-retention.json');
  let successful = [];
  let stateStat;
  try { stateStat = fs.lstatSync(statePath); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (stateStat) {
    if (!stateStat.isFile() || stateStat.isSymbolicLink()) throw new Error('Retention ledger must not be a symlink or directory');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (state.version !== 1 || !Array.isArray(state.successful) || state.successful.some(sha => !SHA.test(sha))) {
      throw new Error('Invalid retention ledger; refusing cleanup');
    }
    successful = [...new Set(state.successful)];
  }
  // Bootstrap only the previous checkout already verified by the deploy preflight.
  // Other pre-policy releases stay unmanaged until a separate reviewed cleanup.
  let previousPath = previous ? fs.realpathSync(previous) : null;
  const previousSha = previousPath && path.basename(previousPath);
  if (previousSha && previousPath === path.join(releases, previousSha) && validRelease(previousSha)
    && !successful.includes(previousSha)) successful.push(previousSha);
  successful = successful.filter(sha => sha !== active).concat(active);
  const existing = successful.filter(validRelease);
  const keep = existing.slice(-(ROLLBACK_COUNT + 1));
  const protectedPaths = [activePath, previousPath, ...processPaths(apps)].filter(Boolean);
  const report = {
    mode: apply ? 'apply' : 'dry-run', keep, remove: [], removed: [], blocked: [],
    unmanaged: fs.readdirSync(releases).filter(name => !successful.includes(name)),
  };
  for (const sha of existing.filter(sha => !keep.includes(sha))) {
    const directory = path.join(releases, sha);
    const reason = protectedPaths.some(target => isInside(target, directory))
      ? 'Referenced by current, previous, PM2, or a live process' : unsafeContents(directory, shared);
    if (reason) report.blocked.push({ sha, reason });
    else report.remove.push(sha);
  }
  if (!apply) return report;

  const temporary = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, successful }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, statePath);
  for (const sha of report.remove) {
    const directory = path.join(releases, sha);
    // Recheck immediately before Git removes this exact registered worktree.
    const live = processPaths(apps);
    if (!validRelease(sha) || fs.realpathSync(path.join(root, 'current')) !== activePath
      || live.some(target => isInside(target, directory)) || unsafeContents(directory, shared)) {
      report.blocked.push({ sha, reason: 'Safety check changed before removal' });
      continue;
    }
    try {
      git(repo, ['worktree', 'remove', '--force', '--', directory]);
      report.removed.push(sha);
    } catch {
      report.blocked.push({ sha, reason: 'Git refused worktree removal' });
    }
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const value = name => args[args.indexOf(name) + 1];
    if (!args.includes('--active')) throw new Error('Usage: retain-production-releases.mjs --active SHA --previous PATH [--apply]; PM2 JSON on stdin');
    const report = retainProductionReleases({
      root: process.env.LMS_DEPLOY_ROOT || '/root/lms',
      active: value('--active'), previous: args.includes('--previous') ? value('--previous') : null,
      appName: process.env.LMS_PM2_APP_NAME || 'lms',
      apps: JSON.parse(fs.readFileSync(0, 'utf8')), apply: args.includes('--apply'),
    });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`Release retention skipped: ${error.message}`);
    process.exitCode = 1;
  }
}
