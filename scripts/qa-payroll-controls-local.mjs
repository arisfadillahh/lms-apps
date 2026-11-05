/** Local-only QA for approved controls; keeps existing database and final history. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
const base = 'http://127.0.0.1:3005', backend = 'http://127.0.0.1:4055';
assert.equal((await fetch(backend + '/health').then(r => r.json())).local, true);
const out = path.resolve('.codex-payroll-local/qa-controls'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const checks = [], errors = [], contexts = [];
function pass(s) { checks.push(s); console.log('PASS ' + s); }
async function login(role, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport }); contexts.push(context);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await context.request.get(backend + '/preview?as=' + role, { maxRedirects: 0 });
  return { context, request: context.request, page };
}
try {
  const finance = await login('finance'), coach = await login('coach'), limited = await login('limited');
  const get = async (id = '2026-11') => {
    const r = await finance.request.get(base + `/api/admin/payroll?year=${id.slice(0, 4)}&month=${Number(id.slice(5))}`);
    assert.equal(r.status(), 200, await r.text()); return r.json();
  };
  const command = async (action, extra = {}, id = '2026-11', expected = 200) => {
    const d = await get(id), r = await finance.request.post(base + '/api/admin/payroll', { data: { action, periodId: id, revision: d.selected?.revision, ...extra } });
    assert.equal(r.status(), expected, await r.text()); return r.json();
  };
  assert.equal((await limited.request.get(base + '/api/admin/payroll')).status(), 403);
  assert.equal((await coach.request.get(base + '/api/admin/payroll')).status(), 403);
  let d = await get(); assert.equal(d.settings.automation_enabled, false); assert.equal(d.legacyBaseline.rows.length, 18);
  pass('Dedicated finance account can manage payroll; unrelated roles denied; automation disabled');
  await command('assignPic', { userId: '10000000-0000-4000-8000-000000000007' });
  await coach.page.goto(base + '/coach/payroll');
  const marker = 'QA koreksi ' + randomUUID().slice(0, 8);
  await coach.page.locator('textarea[name=message]').fill(marker + ' kelas tanggal 3 perlu diperiksa');
  await coach.page.getByRole('button', { name: 'Ajukan koreksi', exact: true }).click();
  await coach.page.getByText('Pengajuan tersimpan.', { exact: false }).waitFor();
  await finance.page.goto(base + '/admin/payroll');
  await finance.page.getByRole('button', { name: /Pengajuan coach/ }).click();
  const article = finance.page.locator('article').filter({ hasText: marker }); await article.waitFor();
  await article.getByRole('combobox', { name: 'Keputusan' }).selectOption('IN_PROGRESS');
  await article.locator('textarea').fill('Sedang memeriksa kegiatan');
  await article.getByRole('button', { name: 'Simpan tanggapan' }).click();
  await article.getByText('Tanggapan: Sedang memeriksa kegiatan', { exact: true }).waitFor();
  await finance.page.screenshot({ path: path.join(out, 'finance-corrections-desktop.png'), fullPage: true });
  await article.getByRole('combobox', { name: 'Keputusan' }).selectOption('DONE');
  await article.locator('textarea').fill(marker + ' sudah diperiksa');
  await article.getByRole('button', { name: 'Simpan tanggapan' }).click(); await article.waitFor({ state: 'detached' });
  await coach.page.reload(); await coach.page.getByText('Tanggapan admin: ' + marker + ' sudah diperiksa').waitFor();
  let own = await (await coach.request.get(base + '/api/coach/payroll')).json();
  assert(!/"(?:amount|rate|total|transfers|history|terms|base_salary)":/.test(JSON.stringify(own)));
  assert(!/pengecualian|force majeure|hubungi admin/i.test(await coach.page.locator('main').last().innerText()));
  await coach.page.screenshot({ path: path.join(out, 'coach-attendance-desktop.png'), fullPage: true });
  pass('Coach → PIC → in progress → done works in UI; coach API omits all financial fields');
  const profileId = '20000000-0000-4000-8000-000000000001';
  await command('activity', { profileId, date: '2026-11-03', kind: 'WEEKLY', delivery: 'OFFLINE', students: 2, mode: 'MITRA', label: marker, reason: 'Pemeriksaan QA lokal' });
  await command('calculate'); d = await get();
  const activity = d.selected.document.activities.find(a => a.label.startsWith(marker));
  assert.equal(d.selected.document.slips.find(s => s.profile_id === profileId).lines.find(l => l.key === 'manual-activity:' + activity.id).amount, 105000);
  await command('removeActivity', { id: activity.id, reason: 'Selesai pemeriksaan QA lokal' }); await command('calculate');
  pass('Missing-class correction uses category, delivery and student count; QA activity cleaned up');
  d = await get('2026-10'); const t = d.selected.document.transfers.filter(t => t.profile_id === profileId && !(d.selected.document.transfer_reversals ?? []).some(r => r.transfer_id === t.id)).at(-1);
  assert(t); await command('reverseTransfer', { transferId: t.id, reason: 'Uji salah tanda transfer lokal' }, '2026-10');
  assert.equal((await coach.request.get(base + `/api/payroll/2026-10/${profileId}/pdf`)).status(), 409);
  await command('reverseTransfer', { transferId: t.id, reason: 'Coba pengulangan lokal' }, '2026-10', 409);
  await command('transfer', { profileIds: [profileId], reference: 'Pulihkan penandaan simulasi QA' }, '2026-10');
  d = await get('2026-10'); assert.equal(d.selected.document.transfers.find(x => x.id === t.id).amount, t.amount);
  assert(d.audit.some(a => a.action === 'REVERSETRANSFER'));
  pass('Wrong transfer marking keeps history, revokes slip access, rejects duplicate reversal and can be marked again');
  const late = await coach.request.post(base + '/api/coach/payroll', { data: { periodId: '2026-10', message: 'Koreksi sudah melewati deadline' } });
  assert.equal(late.status(), 400); assert(!/pengecualian|hubungi admin/i.test(await late.text()));
  await coach.page.setViewportSize({ width: 390, height: 844 }); await coach.page.reload(); await coach.page.locator('textarea[name=message]').waitFor();
  assert(await coach.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await coach.page.screenshot({ path: path.join(out, 'coach-attendance-mobile.png'), fullPage: true });
  await finance.page.setViewportSize({ width: 390, height: 844 }); await finance.page.reload(); await finance.page.getByRole('button', { name: /Pengajuan coach/ }).click();
  await finance.page.getByRole('combobox', { name: 'PIC periode' }).waitFor(); assert(await finance.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await finance.page.screenshot({ path: path.join(out, 'finance-corrections-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []); pass('Desktop and mobile controls render without overflow or browser exceptions; late coach requests blocked');
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
  for (const c of contexts) await c.close(); await browser.close();
}
