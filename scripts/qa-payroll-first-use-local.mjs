/** Task-based first-use walkthrough via visible UI. Local setup/cleanup is explicit. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
const base = 'http://127.0.0.1:3005', backend = 'http://127.0.0.1:4055';
assert.equal((await fetch(backend + '/health').then(r => r.json())).local, true);
const out = path.resolve('.codex-payroll-local/qa-first-use'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const contexts = [], checks = [], errors = []; const pass = s => { checks.push(s); console.log('PASS ' + s); };
async function signIn(username, target, viewport = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ viewport }); contexts.push(context); const page = await context.newPage();
  const auth = [];
  page.on('response', async response => {
    const endpoint = new URL(response.url()).pathname;
    if (!['/api/auth/session', '/api/auth/callback/credentials'].includes(endpoint)) return;
    const data = await response.json().catch(() => ({}));
    auth.push({ endpoint, status: response.status(), role: data.user?.role ?? null, destination: data.url ? new URL(data.url).pathname : null, csrf: data.url ? new URL(data.url).searchParams.has('csrf') : false });
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  if (process.argv.includes('--csrf-retry')) {
    let rejected = false;
    await page.route('**/api/auth/callback/credentials', route => {
      if (rejected) return route.continue();
      rejected = true;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: base + '/api/auth/signin?csrf=true' }) });
    });
  }
  await page.goto(base + '/login'); await page.locator('input[name=username]').fill(username); await page.locator('input[name=password]').fill('DemoLokal2026!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  try { await page.waitForURL(base + target); } catch (error) { console.error('Login diagnostics', username, JSON.stringify(auth)); throw error; }
  return { page, request: context.request };
}
try {
  if (process.argv.includes('--login-only')) {
    for (let round = 0; round < 3; round++) for (const [username, target] of [['coach.demo', '/coach/dashboard'], ['coachlead.demo', '/admin/coach-attendance'], ['finance.demo', '/admin/payroll'], ['admin', '/admin/dashboard']]) {
      const account = await signIn(username, target); await account.page.context().close();
      pass(`Normal login ${username} round ${round + 1}`);
    }
    assert.deepEqual(errors, []);
  } else {
  const marker = 'Uji awal ' + randomUUID().slice(0, 8);
  const coach = await signIn('coach.demo', '/coach/dashboard');
  await coach.page.locator('a[href="/coach/payroll"]').first().click(); await coach.page.locator('textarea[name=message]').fill(marker + ' kelas perlu diperiksa');
  await coach.page.getByRole('button', { name: 'Ajukan koreksi', exact: true }).click(); await coach.page.getByText('Pengajuan tersimpan.', { exact: false }).waitFor();
  const activityForm = coach.page.getByRole('form', { name: 'Form aktivitas tambahan' });
  await activityForm.getByRole('combobox', { name: 'Jenis aktivitas' }).selectOption('EVENT');
  await activityForm.locator('[name=activityAt]').fill('2026-11-03T10:00'); await activityForm.locator('[name=label]').fill(marker + ' kegiatan');
  await activityForm.locator('[name=notes]').fill('Kegiatan contoh lokal untuk pemeriksaan alur pertama');
  await activityForm.getByRole('button', { name: 'Ajukan aktivitas ke admin' }).click();
  await coach.page.getByText(marker + ' kegiatan', { exact: false }).last().waitFor();
  pass('Ordinary coach finds attendance from navigation and submits correction/activity through UI');
  const lead = await signIn('coachlead.demo', '/admin/coach-attendance');
  await lead.page.getByRole('link', { name: 'Absensi & koreksi coach', exact: true }).waitFor();
  const article = lead.page.locator('article').filter({ hasText: marker }); await article.waitFor();
  await article.getByRole('button', { name: 'Periksa aktivitas coach' }).click();
  assert.equal(await lead.page.getByRole('combobox', { name: 'Filter coach' }).inputValue(), '20000000-0000-4000-8000-000000000001');
  await lead.page.getByRole('button', { name: 'Koreksi', exact: true }).first().click();
  const dialog = lead.page.getByRole('dialog'); await dialog.getByLabel('Alasan koreksi').fill(marker + ' sumber sudah diperiksa');
  await dialog.getByRole('button', { name: 'Simpan koreksi aktivitas' }).click(); await dialog.waitFor({ state: 'detached' });
  await lead.page.getByText('Perubahan disimpan dan daftar aktivitas diperbarui.', { exact: true }).waitFor();
  await lead.page.getByRole('tab', { name: 'Pengajuan koreksi', exact: true }).click();
  await article.getByRole('combobox', { name: 'Keputusan' }).selectOption('DONE'); await article.locator('textarea').fill(marker + ' aktivitas sudah sesuai');
  await article.getByRole('button', { name: 'Simpan tanggapan' }).click(); await article.waitFor({ state: 'detached' });
  pass('Coach lead lands directly in workspace; request opens filtered activities; save refreshes data automatically');
  await lead.page.getByRole('tab', { name: 'Event & kegiatan', exact: true }).click();
  const row = lead.page.getByRole('row').filter({ hasText: marker + ' kegiatan' }); await row.getByRole('button', { name: 'Tinjau aktivitas' }).click();
  await lead.page.getByRole('dialog').getByRole('heading', { name: 'Tinjau aktivitas' }).waitFor();
  await lead.page.getByRole('dialog').locator('[name=status]').selectOption('REJECTED');
  await lead.page.getByRole('dialog').locator('[name=reason]').fill('Data QA selesai diperiksa; tidak menambah pembayaran');
  await lead.page.getByRole('dialog').getByRole('button', { name: 'Simpan keputusan aktivitas' }).click(); await lead.page.getByRole('dialog').waitFor({ state: 'detached' });
  pass('Event review opens a focused popup and returns to the list after decision');
  const finance = await signIn('finance.demo', '/admin/payroll');
  await finance.page.getByRole('heading', { name: 'Gaji & Slip Gaji', exact: true }).waitFor();
  assert.equal(await finance.page.getByRole('button', { name: 'Finalisasi', exact: true }).isDisabled(), true);
  await finance.page.getByText(/Finalisasi mulai|Finalisasi menunggu/).first().waitFor();
  await finance.page.screenshot({ path: path.join(out, 'finance-first-use-desktop.png'), fullPage: true });
  // Isolated fixture: reopen the payment marker of one already-paid demo recipient.
  const profile = '20000000-0000-4000-8000-000000000001';
  let data = await (await finance.request.get(base + '/api/admin/payroll?year=2026&month=10')).json();
  for (const t of data.selected.document.transfers.filter(t => t.profile_id === profile && !(data.selected.document.transfer_reversals ?? []).some(r => r.transfer_id === t.id))) {
    const r = await finance.request.post(base + '/api/admin/payroll', { data: { action: 'reverseTransfer', periodId: '2026-10', revision: data.selected.revision, transferId: t.id, reason: 'Persiapan simulasi alur pengguna baru' } }); assert.equal(r.status(), 200);
    data = await (await finance.request.get(base + '/api/admin/payroll?year=2026&month=10')).json();
  }
  await finance.page.getByRole('combobox', { name: 'Bulan arsip' }).selectOption('10');
  await finance.page.getByRole('tab', { name: 'Pembayaran & slip', exact: true }).waitFor();
  await finance.page.getByRole('checkbox', { name: 'Pilih Coach Mitra Demo', exact: true }).check();
  finance.page.on('dialog', d => d.accept());
  await finance.page.getByRole('button', { name: 'Tandai sudah transfer', exact: true }).click();
  await finance.page.getByRole('button', { name: 'Kirim slip gaji', exact: true }).waitFor();
  await finance.page.getByRole('button', { name: 'Kirim slip gaji', exact: true }).click();
  await finance.page.getByRole('checkbox', { name: 'Pilih Coach Mitra Demo', exact: true }).waitFor();
  await finance.page.getByRole('row').filter({ hasText: 'Coach Mitra Demo' }).getByText('Simulasi local', { exact: true }).waitFor();
  pass('Finance sees why finalization is unavailable; archived payment leads from transfer marker to simulated slip');
  await lead.page.setViewportSize({ width: 390, height: 844 }); await lead.page.getByRole('tab', { name: 'Pengajuan koreksi', exact: true }).click();
  assert(await lead.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const tab of await lead.page.getByRole('tablist', { name: 'Area absensi' }).getByRole('tab').all()) {
    const bounds = await tab.boundingBox(); assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Every attendance tab is visible on mobile');
  }
  await lead.page.screenshot({ path: path.join(out, 'coachlead-first-use-mobile.png'), fullPage: true });
  await finance.page.setViewportSize({ width: 390, height: 844 });
  assert(await finance.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await finance.page.screenshot({ path: path.join(out, 'finance-first-use-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []); pass('First-use tasks complete on desktop and fit mobile without browser exceptions');
  }
} finally { fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, errors }, null, 2)); for (const c of contexts) await c.close(); await browser.close(); }
