#!/usr/bin/env node
// Confirmed identity manifest and backups must stay outside Git. No messages/payments.
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { linkLegacyIdentities } from '../src/lib/payroll/legacyIdentity.ts';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const apply = args.includes('--apply'), input = option('--manifest'), envFile = option('--env'), backupRoot = option('--backup-dir');
if (!input || !envFile || (apply && (!backupRoot || !path.isAbsolute(backupRoot)))) throw new Error('Usage: --manifest private.json|- --env /private/.env [--apply --backup-dir /private/backups]');
const manifest = JSON.parse(input === '-' ? await new Promise((resolve, reject) => {
  let value = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { value += chunk; }); process.stdin.on('end', () => resolve(value)); process.stdin.on('error', reject);
}) : await fs.readFile(input, 'utf8'));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!Array.isArray(manifest.profiles) || !manifest.links || !Array.isArray(manifest.period_ids) || !manifest.period_ids.length) throw new Error('Invalid confirmation manifest.');
if (new Set(manifest.profiles.map(p => p.id)).size !== manifest.profiles.length || new Set(manifest.profiles.map(p => p.user_id)).size !== manifest.profiles.length) throw new Error('Duplicate recipient identity.');
for (const p of manifest.profiles) if (!uuid.test(p.id) || !uuid.test(p.user_id) || p.kind !== 'COACH' || typeof p.active !== 'boolean' || !p.name || p.staff_phone !== null) throw new Error('Invalid coach profile.');
for (const id of manifest.period_ids) if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(id)) throw new Error('Invalid period ID.');
const contractSetup = manifest.contract_setup ?? [];
if (!Array.isArray(contractSetup) || contractSetup.some(c => !uuid.test(c.profile_id) || !['MITRA', 'FULLTIME'].includes(c.contract)) || new Set(contractSetup.map(c => c.profile_id)).size !== contractSetup.length) throw new Error('Invalid confirmed coach contracts.');
if (contractSetup.length && (!/^20\d{2}-\d{2}-\d{2}$/.test(manifest.contract_effective_from ?? '') || !manifest.contract_confirmation_reason?.trim())) throw new Error('Contract setup requires a confirmed effective date and reason.');
const env = Object.fromEntries((await fs.readFile(envFile, 'utf8')).split('\n').filter(l => l.includes('=') && !l.trimStart().startsWith('#')).map(l => {
  const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const base = new URL('/rest/v1/', env.NEXT_PUBLIC_SUPABASE_URL), key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('Database credential unavailable.');
async function request(resource, method = 'GET', body, prefer) {
  const response = await fetch(new URL(resource, base), { method, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`Database ${method} ${resource.split('?')[0]} failed: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
async function settingsDisabled() {
  const [settings] = await request('payroll_settings?select=automation_enabled,active_from&id=eq.1');
  if (!settings || settings.automation_enabled !== false) throw new Error('Payroll automation must remain disabled.');
  return settings;
}
const [settings, users, profiles, terms, periods] = await Promise.all([
  settingsDisabled(), request('users?select=id,full_name,role,is_active&role=eq.COACH'), request('payroll_profiles?select=*'), request('payroll_terms?select=*'), request('payroll_periods?select=*&order=id'),
]);
const plannedProfiles = [];
for (const p of manifest.profiles) {
  const user = users.find(u => u.id === p.user_id), byId = profiles.find(x => x.id === p.id), byUser = profiles.find(x => x.user_id === p.user_id);
  if (!user || user.role !== 'COACH' || user.full_name !== p.name || user.is_active !== p.active) throw new Error('Coach identity or active state changed; refresh the manifest.');
  if ((byUser && byUser.id !== p.id) || (byId && (byId.user_id !== p.user_id || byId.kind !== 'COACH'))) throw new Error('Recipient already exists with a different identity; refresh the manifest.');
  if (!byId) plannedProfiles.push({ id: p.id, user_id: p.user_id, kind: 'COACH', name: user.full_name, job_title: p.job_title, staff_phone: null, active: user.is_active });
}
const allProfiles = [...profiles, ...plannedProfiles], linkedProfiles = new Set();
for (const link of Object.values(manifest.links)) if (link.status === 'LINKED') {
  const profile = allProfiles.find(p => p.id === link.profile_id);
  if (!profile || profile.user_id !== link.user_id || profile.kind !== link.kind || profile.name !== link.name) throw new Error('Confirmed link does not match the current recipient.');
  linkedProfiles.add(profile.id);
}
const sourceIds = new Set(periods.filter(p => manifest.period_ids.includes(p.id)).flatMap(p => (p.document.legacy_imports ?? []).flatMap(s => s.rows.map(r => r.sourceId))));
if (Object.keys(manifest.links).some(id => !sourceIds.has(id))) throw new Error('Confirmation contains a source identity not found in the imported archives.');
const plannedPeriods = manifest.period_ids.map(id => {
  const record = periods.find(p => p.id === id); if (!record?.document.legacy_imports?.length) throw new Error('Expected imported archive not found.');
  const document = linkLegacyIdentities(record.document, manifest.links); return { record, document, changed: !isDeepStrictEqual(document, record.document) };
});
const plannedTerms = [];
for (const { profile_id: id, contract } of contractSetup) {
  if (!linkedProfiles.has(id) || allProfiles.find(p => p.id === id)?.kind !== 'COACH') throw new Error('Contract setup is restricted to confirmed coach recipients.');
  // Existing payroll terms belong to the operator; never overwrite them in an import.
  if (terms.some(t => t.profile_id === id)) continue;
  // A zero fulltime base is visibly incomplete and blocks finalization in the engine.
  plannedTerms.push({ profile_id: id, effective_from: manifest.contract_effective_from, contract, base_salary: 0, position_allowance: 0, other_allowances: [] });
}
const summary = { newProfiles: plannedProfiles.length, newMitraTerms: plannedTerms.filter(t => t.contract === 'MITRA').length, newFulltimeTerms: plannedTerms.filter(t => t.contract === 'FULLTIME').length, linkedSources: Object.values(manifest.links).filter(l => l.status === 'LINKED').length, ignoredSources: Object.values(manifest.links).filter(l => l.status === 'IGNORED').length, changedPeriods: plannedPeriods.filter(p => p.changed).length };
if (!apply) {
  console.log(JSON.stringify({ mode: 'DRY_RUN', ...summary, automationEnabled: false }));
} else {
  process.umask(0o077);
  const backupDir = path.join(backupRoot, new Date().toISOString().replaceAll(':', '-'));
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(backupDir, 'identity-before.json.gz'), gzipSync(JSON.stringify({ settings, profiles, terms, periods, manifest })), { mode: 0o600, flag: 'wx' });
  await settingsDisabled();
  if (plannedProfiles.length) await request('payroll_profiles?on_conflict=id', 'POST', plannedProfiles, 'resolution=ignore-duplicates,return=representation');
  for (const term of plannedTerms) {
    // Recheck before each insert in case an operator configured the contract meanwhile.
    const existing = await request(`payroll_terms?select=profile_id&profile_id=eq.${term.profile_id}`);
    if (!existing.length) await request('payroll_terms?on_conflict=profile_id,effective_from', 'POST', term, 'resolution=ignore-duplicates,return=representation');
  }
  const results = [];
  for (const { record, document, changed } of plannedPeriods) {
    await settingsDisabled();
    if (!changed) { results.push({ period: record.id, status: 'UNCHANGED' }); continue; }
    await request('rpc/payroll_commit_period', 'POST', { p_id: record.id, p_expected_revision: record.revision, p_document: document, p_actor_id: null, p_action: 'CONFIRM_LEGACY_IDENTITIES', p_reason: 'User-confirmed source identities. Excluded identities remain archive-only; no source totals, payments or deliveries changed.' });
    const [saved] = await request(`payroll_periods?select=*&id=eq.${record.id}`);
    if (!isDeepStrictEqual(saved.document, document)) throw new Error('Period readback mismatch; inspect the private backup.');
    results.push({ period: record.id, status: 'LINKED', revision: saved.revision });
  }
  const [afterProfiles, afterTerms, afterSettings] = await Promise.all([request('payroll_profiles?select=*'), request('payroll_terms?select=*'), settingsDisabled()]);
  for (const before of profiles) if (!isDeepStrictEqual(before, afterProfiles.find(p => p.id === before.id))) throw new Error('An existing profile changed concurrently; review before continuing.');
  for (const before of terms) if (!isDeepStrictEqual(before, afterTerms.find(t => t.id === before.id))) throw new Error('An existing term changed concurrently; review before continuing.');
  for (const expected of plannedProfiles) {
    const actual = afterProfiles.find(p => p.id === expected.id);
    if (!actual || Object.keys(expected).some(k => !isDeepStrictEqual(expected[k], actual[k]))) throw new Error('New profile readback mismatch.');
  }
  for (const expected of plannedTerms) {
    const actual = afterTerms.find(t => t.profile_id === expected.profile_id && t.effective_from === expected.effective_from);
    if (!actual || Object.keys(expected).some(k => !isDeepStrictEqual(expected[k], actual[k]))) throw new Error('Contract setup changed concurrently; review the recipient.');
  }
  if (!isDeepStrictEqual(afterSettings, settings)) throw new Error('Payroll settings changed during identity linking.');
  console.log(JSON.stringify({ mode: 'APPLIED', backupDir, ...summary, results, automationEnabled: false }));
}
