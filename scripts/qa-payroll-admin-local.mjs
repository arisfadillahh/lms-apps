/** Normal-login and payroll UI regression QA. Isolated local fixture only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:3005';
assert.equal((await fetch('http://127.0.0.1:4055/health').then(r => r.json())).local, true);
const out = path.resolve('.codex-payroll-local/qa');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [], downloads = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
page.on('download', e => downloads.push(e.suggestedFilename()));
const pass = label => { checks.push(label); console.log('PASS ' + label); };
const state = async () => (await context.request.get(base + '/api/admin/payroll?year=2026&month=11')).json();
let testProfile;
try {
  assert.equal((await context.request.get(base + '/api/admin/payroll')).status(), 401);
  const initialSession = page.waitForResponse(r => r.url().endsWith('/api/auth/session'));
  await page.goto(base + '/login');
  await initialSession;
  await page.locator('[name=username]').fill('admin');
  await page.locator('[name=password]').fill('DemoLokal2026!');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.waitForURL('**/admin/dashboard');
  await page.getByRole('heading', { name: 'Selamat datang di Admin Clevio', exact: true }).waitFor();
  pass('Normal admin credentials reach the dashboard');
  const routes = [
    '/admin/payments', '/admin/classes', '/admin/users', '/admin/free-trials',
    '/admin/trial-assessments', '/admin/leave',
    '/admin/classes/30000000-0000-4000-8000-000000000001', '/admin/dashboard',
  ];
  for (const route of routes) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200, route);
    await page.getByText('Memuat halaman', { exact: true }).waitFor({ state: 'hidden' });
    await page.locator('h1').first().waitFor();
    assert.doesNotMatch(await page.locator('body').innerText(), /Application error:|Failed to list class lessons/);
  }
  pass('Eight admin routes including class detail load without database errors');
  await page.goto(base + '/admin/payroll');
  await page.getByPlaceholder('Nama atau jabatan').waitFor();
  const staffRow = page.locator('tbody tr').filter({ hasText: 'Staf Operasional Demo' });
  await staffRow.getByRole('button', { name: 'Rincian', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Rincian Staf Operasional Demo', exact: true });
  await detail.waitFor();
  assert.deepEqual(await detail.locator('thead th').allTextContents(), ['Tanggal / aktivitas', 'Jenis & perhitungan', 'Nominal', 'Tindakan']);
  assert.equal(await detail.getByText('Tambahan / potongan manual', { exact: true }).count(), 1);
  await page.screenshot({ path: path.join(out, 'detail-popup-desktop.png') });
  await detail.getByRole('button', { name: 'Pratinjau slip', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Pratinjau slip gaji', exact: true });
  await preview.waitFor();
  const frame = page.frameLocator('iframe[title="Pratinjau slip gaji Clevio"]');
  await frame.getByRole('heading', { name: 'Slip gaji', exact: true }).waitFor();
  assert.equal(await frame.getByAltText('Clevio Innovator Camp').evaluate(e => e.complete && e.naturalWidth > 0), true);
  assert.equal(await page.locator('a[href*="/api/payroll/"]').count(), 0);
  await page.screenshot({ path: path.join(out, 'slip-popup-desktop.png') });
  pass('Details and branded slip open in dialogs without PDF links or downloads');
  await page.keyboard.press('Escape');
  await detail.waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Coach & staf', exact: true }).click();
  await page.getByRole('button', { name: 'Tambah penerima', exact: true }).click();
  await page.locator('form').filter({ has: page.locator('[name=baseSalary]') }).locator('select').first().selectOption('STAFF');
  const form = page.locator('form').filter({ has: page.locator('[name=staffPhone]') });
  const name = `Staf QA Tunjangan ${Date.now()}`;
  await form.locator('[name=name]').fill(name);
  await form.locator('[name=staffPhone]').fill('081234000001');
  await form.locator('[name=jobTitle]').fill('Operasional QA');
  await form.locator('[name=baseSalary]').fill('3000000');
  await form.locator('[name=effectiveFrom]').fill('2026-11-01');
  await form.locator('[name=positionAllowance]').fill('500000');
  await form.getByRole('button', { name: 'Tambah tunjangan rutin lainnya', exact: true }).click();
  await form.getByLabel('Nama tunjangan 1', { exact: true }).fill('Komunikasi');
  await form.getByLabel('Nominal tunjangan 1', { exact: true }).fill('100000');
  const saved = page.waitForResponse(r => r.url().endsWith('/api/admin/payroll') && r.request().method() === 'POST');
  await form.getByRole('button', { name: 'Simpan penerima & kontrak', exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page.getByText('Perubahan tersimpan.', { exact: true }).waitFor();
  const data = await state();
  testProfile = data.people.find(p => p.name === name);
  assert.equal(testProfile.user_id, null);
  assert.equal(testProfile.staff_phone, '081234000001');
  const term = data.terms.find(t => t.profile_id === testProfile.id);
  assert.equal(term.position_allowance, 500000);
  assert.deepEqual(term.other_allowances, [{ label: 'Komunikasi', amount: 100000 }]);
  await page.getByText(name, { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Profil & tunjangan', exact: true }).click();
  assert.equal(await form.locator('[name=positionAllowance]').inputValue(), '500000');
  assert.equal(await form.getByLabel('Nama tunjangan 1', { exact: true }).inputValue(), 'Komunikasi');
  await page.screenshot({ path: path.join(out, 'staff-allowances-desktop.png'), fullPage: true });
  pass('Admin saves and reloads recurring allowances and WA for staff without an LMS account');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('button', { name: 'Rekap & arsip', exact: true }).click();
  await staffRow.getByRole('button', { name: 'Rincian', exact: true }).click();
  await detail.waitFor();
  let box = await detail.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845);
  await page.screenshot({ path: path.join(out, 'detail-popup-mobile.png') });
  await detail.getByRole('button', { name: 'Pratinjau slip', exact: true }).click();
  await preview.waitFor();
  box = await preview.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845);
  assert.equal(await frame.locator('body').evaluate(e => e.scrollWidth <= e.ownerDocument.defaultView.innerWidth), true);
  await page.screenshot({ path: path.join(out, 'slip-popup-mobile.png') });
  pass('Mobile profile and both dialogs fit the viewport with readable scrolling');
  assert.deepEqual(downloads, []);
  assert.deepEqual(errors, []);
  pass('No browser exceptions, console errors or accidental downloads');
} finally {
  if (testProfile) {
    const r = await context.request.post(base + '/api/admin/payroll', { data: {
      action: 'profile', id: testProfile.id, kind: 'STAFF', userId: null, name: testProfile.name,
      jobTitle: 'Operasional QA', staffPhone: testProfile.staff_phone, active: false,
      contract: 'FULLTIME', baseSalary: 3000000, positionAllowance: 500000,
      otherAllowances: [{ label: 'Komunikasi', amount: 100000 }], effectiveFrom: '2026-11-01',
    } });
    assert.equal(r.status(), 200, 'Deactivate synthetic QA recipient');
  }
  fs.writeFileSync(path.join(out, 'admin-followup-results.json'), JSON.stringify({ checks, errors, downloads }, null, 2));
  await browser.close();
}
