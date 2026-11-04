/** End-to-end QA against dev:payroll-local only. Never use with production. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:3005', landing = 'http://127.0.0.1:4055';
const health = await fetch(landing + '/health').then(r => r.json());
assert.equal(health.local, true, 'Isolated payroll local server required');
const out = path.resolve('.codex-payroll-local/qa'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const checks = [], errors = [];
const pass = label => { checks.push(label); console.log('PASS ' + label); };
async function login(as, viewport = { width: 1440, height: 1000 }) {
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(as + ': ' + e.message));
  if (['coder','limited'].includes(as)) {
    // These accounts exist only to test denied payroll API access. The isolated
    // fixture intentionally does not model unrelated coder/class dashboards.
    await ctx.request.get(landing + '/preview?as=' + as, { maxRedirects: 0 });
    return { ctx, page, request: ctx.request };
  }
  await page.goto(landing + '/preview?as=' + as); return { ctx, page, request: ctx.request };
}
try {
  if (process.argv.includes('--refresh-pdfs')) {
    const admin = await login('admin');
    const state = await (await admin.request.get(base + '/api/admin/payroll?year=2026&month=8')).json();
    const staff = state.people.find(p => p.name === 'Staf QA Tanpa WA');
    for (const [name, url] of [
      ['slip-v1.pdf', '/api/payroll/2026-08/20000000-0000-4000-8000-000000000001/pdf?version=1'],
      ['slip-multipage.pdf', `/api/payroll/2026-08/${staff.id}/pdf?version=1`],
    ]) {
      const r = await admin.request.get(base + url); assert.equal(r.status(), 200);
      fs.writeFileSync(path.join(out, name), await r.body());
    }
    console.log('Refreshed two private salary slip PDF fixtures');
    await browser.close(); process.exit(0);
  }
  const unsigned = await browser.newContext();
  for (const route of ['/api/admin/payroll', '/api/coach/payroll', '/api/payroll/2026-10/20000000-0000-4000-8000-000000000001/pdf']) {
    assert.equal((await unsigned.request.get(base + route)).status(), 401);
  }
  assert.equal((await unsigned.request.get(base + '/api/cron/payroll')).status(), 401);
  pass('Signed-out APIs and cron reject access');
  for (const role of ['coach', 'coder', 'limited']) {
    const s = await login(role);
    assert.equal((await s.request.get(base + '/api/admin/payroll')).status(), 403, role);
    assert.equal((await s.request.post(base + '/api/admin/payroll', { data: { action: 'create', year: 2026, month: 8 } })).status(), 403, role);
    await s.ctx.close();
  }
  pass('Coach, coder and admin without payroll permission cannot manage payroll');
  const admin = await login('admin'), { page, request } = admin;
  page.on('dialog', d => d.accept());
  await page.getByRole('heading', { name: 'Gaji & Slip Gaji' }).waitFor();
  await page.getByPlaceholder('Nama atau jabatan').waitFor();
  const data = async (id = '2026-11') => {
    const r = await request.get(base + `/api/admin/payroll?year=${id.slice(0, 4)}&month=${Number(id.slice(5))}`);
    assert.equal(r.status(), 200, await r.text()); return r.json();
  };
  async function command(action, extra = {}, id = '2026-11', expectedStatus = 200) {
    const state = await data(id);
    const r = await request.post(base + '/api/admin/payroll', { data: { action, periodId: id, revision: state.selected?.revision, ...extra } });
    assert.equal(r.status(), expectedStatus, await r.text()); return r.json();
  }
  const initial = await data();
  assert.equal(initial.selected.document.slips.length, 4);
  assert.deepEqual(initial.selected.document.warnings, []);
  assert.equal(initial.settings.active_from, '2020-01-01');
  pass('Live admin page loads isolated PostgreSQL calculation and date fields');
  await page.getByPlaceholder('Nama atau jabatan').fill('Mitra');
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.getByPlaceholder('Nama atau jabatan').fill('');
  await page.screenshot({ path: path.join(out, 'admin-desktop.png'), fullPage: true });
  pass('Name filtering and desktop rendering');
  const coachId = '20000000-0000-4000-8000-000000000001', fulltimeId = '20000000-0000-4000-8000-000000000002', noWaId = '20000000-0000-4000-8000-000000000003';
  const manualRecap = await command('send', { profileIds: [coachId, noWaId], kind: 'RECAP' });
  assert.deepEqual(manualRecap.result.map(r => r.status), ['SIMULATED', 'LMS_ONLY']);
  pass('Manual recap fallback remains text-only, with local WA simulation and LMS fallback');
  const mitraRow = page.locator('tbody tr').filter({ hasText: 'Coach Mitra Demo' });
  await mitraRow.getByRole('button', { name: 'Rincian', exact: true }).click();
  await page.getByRole('button', { name: 'Koreksi aktivitas', exact: true }).first().click();
  const correction = page.getByRole('form', { name: 'Koreksi aktivitas' });
  await correction.locator('[name=profileId]').selectOption(fulltimeId);
  await correction.locator('[name=mode]').selectOption('MITRA');
  await correction.locator('[name=amount]').fill('12345');
  await correction.locator('[name=reason]').fill('Pengganti sesi untuk QA lokal');
  const sourceKey = initial.selected.document.slips.find(s => s.profile_id === coachId).lines[0].key;
  await correction.getByRole('button', { name: 'Simpan koreksi aktivitas' }).click();
  await page.getByText('Koreksi disimpan. Tutup rincian lalu klik Hitung ulang.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Hitung ulang', exact: true }).click();
  await page.getByText('Rekap dihitung ulang; sumber yang sama tidak digandakan.', { exact: true }).waitFor();
  const changed = (await data()).selected.document;
  assert.equal(changed.slips.find(s => s.profile_id === fulltimeId).lines.find(l => l.key === sourceKey).amount, 12345);
  pass('UI force majeure correction moves actual recipient, mode and fee with audit reason');
  await command('override', { sourceKey, profileId: coachId, mode: 'MITRA', reason: 'Pulihkan data demo setelah QA' });
  await command('calculate');
  await command('finalize', {}, '2026-11', 400);
  pass('Running period cannot be finalized before all of the 25th is included');
  await page.getByRole('button', { name: 'Tarif & otomatisasi', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Bonus goal / anak' }).inputValue(), '100000');
  assert.equal(await page.getByRole('spinbutton', { name: 'Observasi online', exact: true }).inputValue(), '25000');
  assert.equal(await page.getByRole('spinbutton', { name: 'Observasi offline', exact: true }).inputValue(), '50000');
  await page.getByRole('tab', { name: 'Otomatisasi', exact: true }).click();
  assert.equal(await page.locator('input[name=automationEnabled]').isChecked(), false);
  await page.getByRole('tab', { name: 'Mode kelas', exact: true }).click();
  const mode = page.getByRole('combobox', { name: 'Mode mengajar Ekskul Fulltime' });
  await mode.selectOption('MITRA');
  await page.getByText('Perubahan tersimpan.', { exact: true }).waitFor();
  await mode.selectOption('FULLTIME');
  await page.getByRole('button', { name: 'Coach & staf', exact: true }).click();
  await page.getByRole('button', { name: 'Rekap & arsip', exact: true }).click();
  pass('Class mode editor, initial goal rate, people and settings tabs');
  await command('create', { year: 2026, month: 8 }, '2026-08');
  const staff = await command('profile', { kind: 'STAFF', name: 'Staf QA Tanpa WA', jobTitle: 'QA', staffPhone: null, active: true, contract: 'FULLTIME', baseSalary: 1000000, effectiveFrom: '2020-01-01' });
  const staffId = staff.result.id;
  await command('activity', { profileId: coachId, date: '2026-08-20', kind: 'EVENT', mode: 'MITRA', label: 'Event QA', reason: 'Aktivitas untuk pengujian lokal' }, '2026-08');
  let p = (await data('2026-08')).selected.document;
  const activityId = p.activities[0].id;
  await command('removeActivity', { id: activityId, reason: 'Koreksi aktivitas contoh lokal' }, '2026-08');
  await command('component', { profileId: coachId, date: '2026-08-25', label: 'Transport manual QA', amount: 50000, reason: 'Transport yang disetujui admin' }, '2026-08');
  for (let i = 1; i <= 50; i++) await command('component', { profileId: staffId, date: '2026-08-25', label: `Komponen uji PDF panjang ${i}`, amount: 1000, reason: 'Pemeriksaan pagination PDF lokal' }, '2026-08');
  await command('calculate', {}, '2026-08');
  let before = await data('2026-08');
  const stale = await request.post(base + '/api/admin/payroll', { data: { action: 'calculate', periodId: '2026-08', revision: before.selected.revision - 1 } });
  assert.equal(stale.status(), 409);
  await command('finalize', {}, '2026-08');
  p = (await data('2026-08')).selected.document;
  assert.equal(p.status, 'FINAL'); assert.equal(p.history.length, 1);
  const v1 = JSON.stringify(p.history[0]);
  pass('Staff without LMS account, manual transport/activity removal, stale writer and finalization');
  const unpaid = await command('send', { profileIds: [coachId], kind: 'SLIP' }, '2026-08');
  assert.equal(unpaid.result[0].status, 'FAILED');
  await command('transfer', { profileIds: [coachId, noWaId, staffId] }, '2026-08');
  await command('transfer', { profileIds: [coachId, noWaId, staffId] }, '2026-08');
  p = (await data('2026-08')).selected.document;
  assert.equal(p.transfers.length, 3);
  const sent = await command('send', { profileIds: [coachId, noWaId, staffId], kind: 'SLIP' }, '2026-08');
  assert.deepEqual(sent.result.map(x => x.status), ['SIMULATED', 'LMS_ONLY', 'NO_CONTACT']);
  pass('Transfer required; repeat transfer is idempotent; bulk slip uses simulated WA / LMS / no contact');
  const repeat = await command('send', { profileIds: [coachId, noWaId], kind: 'SLIP' }, '2026-08');
  assert.deepEqual(repeat.result.map(x => x.status), ['SIMULATED', 'LMS_ONLY']);
  await command('reopen', { reason: 'Revisi admin setelah deadline bulanan' }, '2026-08');
  await command('component', { profileId: coachId, date: '2026-08-25', label: 'Selisih revisi', amount: 23000, reason: 'Tambahan setelah pemeriksaan admin' }, '2026-08');
  await command('finalize', {}, '2026-08');
  await command('transfer', { profileIds: [coachId] }, '2026-08');
  p = (await data('2026-08')).selected.document;
  assert.equal(p.history.length, 2); assert.equal(JSON.stringify(p.history[0]), v1);
  assert.equal(p.transfers.filter(t => t.profile_id === coachId).length, 2);
  assert.equal(p.transfers.at(-1).amount, 23000);
  pass('Admin revision after deadline preserves v1 and transfer history, pays only the difference');
  const pdf = await request.get(base + `/api/payroll/2026-08/${coachId}/pdf?version=1`);
  assert.equal(pdf.status(), 200); assert.match(pdf.headers()['cache-control'], /private, no-store/);
  fs.writeFileSync(path.join(out, 'slip-v1.pdf'), await pdf.body());
  const recap = await request.get(base + `/api/payroll/2026-11/${coachId}/pdf?kind=RECAP`);
  assert.equal(recap.status(), 404, 'Attendance recap must not be a PDF file');
  const longPdf = await request.get(base + `/api/payroll/2026-08/${staffId}/pdf?version=1`);
  assert.equal(longPdf.status(), 200); fs.writeFileSync(path.join(out, 'slip-multipage.pdf'), await longPdf.body());
  pass('Only salary slips render private PDFs; attendance recap PDF is unavailable');
  const coach = await login('coach');
  const own = await coach.request.get(base + '/api/coach/payroll');
  assert.equal(own.status(), 200);
  const ownBody = await own.json();
  const notifications = await (await coach.request.get(base + '/api/notifications')).json();
  const recapNotification = notifications.data.find(n => n.message.includes('REKAP ABSENSI'));
  assert(recapNotification); assert(recapNotification.message.includes('Weekly Dua Anak'));
  assert(!recapNotification.message.includes('Rp')); assert(!recapNotification.message.includes('465000'));
  fs.writeFileSync(path.join(out, 'recap-message.txt'), recapNotification.message);
  assert(ownBody.periods.every(p => p.slip.user_id === '10000000-0000-4000-8000-000000000002'));
  assert(ownBody.periods.every(p => p.history.every(h => h.slips.every(s => s.user_id === '10000000-0000-4000-8000-000000000002'))));
  assert.equal((await coach.request.get(base + `/api/payroll/2026-10/${fulltimeId}/pdf`)).status(), 404);
  assert.equal((await coach.request.post(base + '/api/coach/payroll', { data: { periodId: '2026-11', message: 'Mohon cek sesi saya untuk contoh QA' } })).status(), 200);
  assert.equal((await coach.request.post(base + '/api/coach/payroll', { data: { periodId: '2026-10', message: 'Laporan ini sudah melewati deadline' } })).status(), 400);
  pass('Coach sees only own records; PDF IDOR blocked; correction deadline enforced');
  const activityForm = coach.page.getByRole('form', { name: 'Form aktivitas tambahan' });
  await activityForm.getByRole('combobox', { name: 'Jenis aktivitas' }).selectOption('EVENT');
  await activityForm.locator('[name=activityAt]').fill('2026-11-03T10:00');
  await activityForm.locator('[name=label]').fill('Event integrasi QA');
  await activityForm.locator('[name=notes]').fill('Kegiatan lokal contoh dengan bukti dan lokasi yang diperiksa');
  await activityForm.getByRole('button', { name: 'Ajukan aktivitas ke admin' }).click();
  await coach.page.getByText('Aktivitas diajukan. Absensi masuk rekap setelah admin menyetujui dan memperbarui rekap.', { exact: true }).waitFor();
  let requestList = await (await coach.request.get(base + '/api/coach/payroll/activities')).json();
  const eventRequest = requestList.requests.find(r => r.label === 'Event integrasi QA');
  assert.equal(eventRequest.status, 'PENDING');
  await command('calculate');
  assert(!(await data()).selected.document.slips.flatMap(s => s.lines).some(l => l.key === `request:${eventRequest.id}`));
  const duplicate = await coach.request.post(base + '/api/coach/payroll/activities', { data: { id: eventRequest.id, activityAt: eventRequest.activity_at, kind: 'EVENT', label: eventRequest.label, notes: eventRequest.notes } });
  assert.equal(duplicate.status(), 409);
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await page.getByRole('button', { name: 'Aktivitas coach (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Tinjau aktivitas', exact: true }).click();
  const review = page.getByRole('form', { name: 'Tinjauan aktivitas' });
  await review.locator('[name=reason]').fill('Bukti pelaksanaan event sudah diperiksa');
  await review.getByRole('button', { name: 'Simpan keputusan aktivitas' }).click();
  await page.getByText('Keputusan tersimpan. Hitung ulang rekap untuk memperbarui gaji.', { exact: true }).waitFor();
  await command('calculate');
  const approved = (await data()).selected.document.slips.find(s => s.profile_id === coachId).lines.find(l => l.key === `request:${eventRequest.id}`);
  assert.equal(approved.amount, 180000);
  await command('reviewActivity', { id: eventRequest.id, requestRevision: 0, status: 'REJECTED', mode: 'MITRA', reason: 'Stale review harus ditolak' }, '2026-11', 409);
  await command('reviewActivity', { id: eventRequest.id, requestRevision: 1, status: 'REJECTED', mode: 'MITRA', reason: 'Pengujian pembatalan persetujuan' });
  await command('calculate');
  assert(!(await data()).selected.document.slips.flatMap(s => s.lines).some(l => l.key === `request:${eventRequest.id}`));
  await command('reviewActivity', { id: eventRequest.id, requestRevision: 2, status: 'APPROVED', mode: 'MITRA', reason: 'Persetujuan akhir kegiatan contoh' });
  await command('calculate');
  pass('Coach submits event through UI; pending/rejected do not pay, approval adds fee once, duplicate and stale reviews blocked');
  await page.getByRole('button', { name: 'Rekap & arsip', exact: true }).click();
  await page.getByRole('button', { name: 'Muat ulang', exact: true }).click();
  await page.getByRole('combobox', { name: 'Bulan arsip' }).selectOption('8');
  await page.getByText('2026-08 · FINAL · v2', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, 'admin-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert((await page.locator('main').last().boundingBox()).width <= 390, 'Admin content must fit viewport, even when shell hides overflow');
  await coach.page.setViewportSize({ width: 390, height: 844 });
  await coach.page.getByRole('heading', { name: /Gaji|Rekap/ }).first().waitFor();
  await coach.page.screenshot({ path: path.join(out, 'coach-mobile.png'), fullPage: true });
  assert(await coach.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert((await coach.page.locator('main').last().boundingBox()).width <= 390, 'Coach content must fit viewport');
  pass('Archive month filter and admin/coach mobile layouts without page overflow');
  assert.deepEqual(errors, []);
  pass('No browser JavaScript errors');
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, errors, finishedAt: new Date().toISOString(), localOnly: true }, null, 2));
  console.log(`QA COMPLETE: ${checks.length} scenario groups passed. Artifacts: ${out}`);
} finally { await browser.close(); }
