// UI fixtures intercept payroll configuration writes; class mode uses a restored local demo row.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:3005';
assert.equal((await fetch('http://127.0.0.1:4055/health').then(r => r.json())).local, true);
const out = path.resolve('.codex-payroll-local/qa-settings'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage(), errors = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
const pass = text => { checks.push(text); console.log('PASS ' + text); };
let restoreClass;
try {
  await page.goto(base + '/login'); await page.locator('[name=username]').fill('admin'); await page.locator('[name=password]').fill('DemoLokal2026!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click(); await page.waitForURL(base + '/admin/dashboard');
  const data = await context.request.get(base + '/api/admin/payroll?year=2026&month=11').then(r => r.json());
  assert.ok(data.people && data.cards && data.coaches);
  const originalClass = data.classes.find(c => c.payroll_mode === 'MITRA' || c.payroll_mode === 'FULLTIME');
  const templateRates = data.cards[0]?.rates;
  assert.ok(templateRates);
  const activeRates = { ...templateRates, GOAL: 110000 };
  data.cards = [{ effective_from: '2026-01-01', rates: activeRates }, { effective_from: '2027-02-01', rates: { ...activeRates, GOAL: 150000 } }];
  const staff = data.people.find(p => p.kind === 'STAFF'); assert.ok(staff);
  const missingCoach = { id: '20000000-0000-4000-8000-000000009991', full_name: 'Coach Belum Kontrak', username: 'fixture', is_active: true };
  data.coaches.push(missingCoach, { ...missingCoach, id: '20000000-0000-4000-8000-000000009992', full_name: 'Coach Nonaktif', is_active: false });
  let lastPost;
  await page.route('**/api/admin/payroll*', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: data });
    lastPost = route.request().postDataJSON();
    assert.equal(lastPost.action, 'rates', 'This walkthrough must not send messages, transfer or change people.');
    data.cards = [...data.cards.filter(c => c.effective_from !== lastPost.effectiveFrom), { effective_from: lastPost.effectiveFrom, rates: lastPost.rates }];
    return route.fulfill({ json: { result: { success: true } } });
  });
  await page.goto(base + '/admin/payroll'); await page.getByRole('button', { name: 'Coach & staf', exact: true }).click();
  await page.getByRole('listitem', { name: 'Penerima Coach Belum Kontrak', exact: true }).waitFor();
  assert.equal(await page.getByRole('listitem', { name: 'Penerima Coach Nonaktif', exact: true }).count(), 0);
  await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'people-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Atur gaji Coach Belum Kontrak', exact: true }).click();
  let dialog = page.getByRole('dialog');
  assert.equal(await dialog.locator('[name=userId]').inputValue(), missingCoach.id);
  assert.equal(await dialog.locator('[name=contract]').inputValue(), '');
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Kategori coach dan staf' }).selectOption('STAFF');
  await page.getByRole('button', { name: `Edit ${staff.name}`, exact: true }).click();
  dialog = page.getByRole('dialog');
  assert.equal(await dialog.locator('[name=staffPhone]').inputValue(), staff.staff_phone ?? '');
  assert.equal(await dialog.locator('[name=userId]').count(), 0);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Kategori coach dan staf' }).selectOption('ALL');
  await page.getByRole('combobox', { name: 'Status penerima gaji' }).selectOption('INACTIVE');
  await page.getByRole('listitem', { name: 'Penerima Coach Nonaktif', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Status penerima gaji' }).selectOption('ACTIVE');
  pass('Unified recipients: active default, staff filter, inactive filter, prefilled coach setup and staff WA edit');
  await page.getByRole('button', { name: 'Tarif & otomatisasi', exact: true }).click();
  assert.equal(await page.getByRole('tab', { name: 'Mode kelas', exact: true }).count(), 0);
  const ratePanel = page.getByRole('region', { name: 'Tarif aktivitas', exact: true });
  await ratePanel.getByText('Rp110.000', { exact: true }).waitFor();
  assert.equal(await ratePanel.locator('input[type=number]').count(), 0);
  await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'rates-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Ubah tarif', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Berlaku mulai', { exact: true }).fill('2027-01-01');
  await dialog.getByLabel('Bonus goal trial · per anak', { exact: true }).fill('125000');
  await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'rates-popup.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Simpan tarif', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
  assert.equal(lastPost.effectiveFrom, '2027-01-01'); assert.equal(lastPost.rates.GOAL, 125000); assert.deepEqual(lastPost.rates.WEEKLY_ONLINE, activeRates.WEEKLY_ONLINE);
  await ratePanel.getByRole('row').filter({ hasText: 'Bonus goal trial' }).getByText('Rp125.000', { exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Lihat riwayat tarif' }).selectOption('');
  await ratePanel.getByText('Rp110.000', { exact: true }).waitFor();
  pass('Rates open the active card; dated edit saves exact payload; future card does not replace the current tariff');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'rates-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.getByRole('button', { name: 'Ubah tarif', exact: true }).click();
  dialog = page.getByRole('dialog');
  const saveBox = await dialog.getByRole('button', { name: 'Simpan tarif', exact: true }).boundingBox();
  assert.ok(saveBox && saveBox.y + saveBox.height <= 844);
  await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'rates-popup-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Coach & staf', exact: true }).click();
  await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'people-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  pass('Mobile recipient list and rate tables contain overflow; popup save remains visible');
  if (originalClass) {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(base + '/admin/classes/' + originalClass.id);
    await page.getByRole('button', { name: 'Ubah mode', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mode mengajar', { exact: true }).selectOption(originalClass.payroll_mode === 'MITRA' ? 'FULLTIME' : 'MITRA');
    restoreClass = originalClass;
    await dialog.getByRole('button', { name: 'Simpan mode', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
    await page.getByText(originalClass.payroll_mode === 'MITRA' ? 'Fulltime — gaji tetap' : 'Mitra — fee per sesi', { exact: true }).waitFor();
    await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, 'class-mode-desktop.png'), fullPage: false });
    pass('Class detail owns mode control; actual local audited API saves and refreshes the class');
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checks, errors, payrollWrites: 'UI fixture only', classMode: 'local demo restored' }, null, 2));
} finally {
  if (restoreClass) {
    const response = await context.request.patch(base + '/api/admin/classes/' + restoreClass.id + '/payroll-mode', { data: { mode: restoreClass.payroll_mode } });
    assert.equal(response.ok(), true);
  }
  await browser.close();
}
