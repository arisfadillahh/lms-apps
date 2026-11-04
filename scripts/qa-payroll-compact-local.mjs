/** Compact slip/toolbar QA. All finance mutations are intercepted in browser memory. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:3005';
assert.equal((await fetch('http://127.0.0.1:4055/health').then(r => r.json())).local, true);
const out = path.resolve('.codex-payroll-local/qa');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.request.get('http://127.0.0.1:4055/preview?as=admin', { maxRedirects: 0 });
const response = await context.request.get(base + '/api/admin/payroll?year=2026&month=11');
assert.equal(response.status(), 200);
const fixture = await response.json(), p = fixture.selected.document;
const original = p.slips.find(s => s.name === 'Coach Mitra Demo');
const other = p.slips.find(s => s.name === 'Coach Fulltime Demo');
const line = (kind, label, amount, key) => ({ key, kind, label, amount, rate: amount, quantity: 1, date: '2026-11-03T09:00:00Z', details: 'Detail sesi hanya untuk rekap absensi' });
const sample = { ...original, lines: [
  line('SALARY', 'Gaji pokok', 3000000, 'salary'),
  line('ALLOWANCE', 'Tunjangan jabatan', 500000, 'position'),
  line('ALLOWANCE', 'Tunjangan komunikasi', 100000, 'communication'),
  line('ADJUSTMENT', 'Transport November', 50000, 'transport'),
  line('ADJUSTMENT', 'Potongan November', -25000, 'deduction'),
  ...Array.from({ length: 100 }, (_, i) => line(i % 2 ? 'EKSKUL' : 'WEEKLY', `Sesi kelas rahasia ${i + 1}`, i % 2 ? 105000 : 70000, `class-${i}`)),
  line('WEEKLY', 'Kelas dibatalkan', 0, 'cancelled'),
  ...Array.from({ length: 2 }, (_, i) => line('TRIAL', `Trial anak ${i}`, 25000, `trial-${i}`)),
  ...Array.from({ length: 5 }, (_, i) => line('GOAL', `Goal anak ${i}`, 100000, `goal-${i}`)),
] };
sample.total = sample.lines.reduce((sum, item) => sum + item.amount, 0);
p.slips = [sample, { ...other, total: 1000000, lines: [line('SALARY', 'Gaji pokok', 1000000, 'other-salary')] }];
p.transfers = []; p.deliveries = {}; p.warnings = []; p.status = 'DRAFT'; p.history = [];
const commands = [], checks = [], errors = [], downloads = [];
const pass = label => { checks.push(label); console.log('PASS ' + label); };
await context.route('**/api/admin/payroll*', async route => {
  if (route.request().method() === 'GET') return route.fulfill({ json: fixture });
  const command = route.request().postDataJSON(); commands.push(command);
  if (command.action === 'transfer') {
    for (const profileId of command.profileIds) p.transfers.push({ id: `qa-${profileId}`, profile_id: profileId, amount: p.slips.find(s => s.profile_id === profileId).total, at: p.ends_at, by: 'qa', reference: '', version: p.version });
    fixture.selected.revision++;
    return route.fulfill({ json: { result: p } });
  }
  assert.equal(command.action, 'send');
  assert.equal(command.kind, 'SLIP');
  return route.fulfill({ json: { result: command.profileIds.map(profileId => ({ profileId, status: 'SIMULATED' })) } });
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('dialog', dialog => dialog.accept());
page.on('pageerror', error => errors.push(error.message));
page.on('console', item => { if (item.type() === 'error') errors.push(item.text()); });
page.on('download', item => downloads.push(item.suggestedFilename()));
try {
  await page.goto(base + '/admin/payroll');
  await page.getByPlaceholder('Nama atau jabatan').waitFor();
  const toolbar = page.getByRole('region', { name: 'Tindakan penerima terpilih' });
  assert.equal(await toolbar.count(), 0);
  assert.deepEqual(await page.getByRole('columnheader').allTextContents(), ['', 'Penerima', 'Total periode', 'Tindakan']);
  assert.equal(await page.getByRole('heading', { name: 'Audit periode', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('button', { name: 'Tutup filter', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Status transfer', { exact: true }).count(), 0);
  await page.getByLabel('Kategori penerima', { exact: true }).selectOption('STAFF');
  assert.equal(await page.getByRole('checkbox', { name: `Pilih ${sample.name}`, exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Reset filter', exact: true }).click();
  await page.getByRole('checkbox', { name: `Pilih ${sample.name}`, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Tutup filter', exact: true }).click();
  await page.getByRole('tab', { name: 'Pembayaran & slip', exact: true }).click();
  await page.getByRole('heading', { name: 'Finalisasi rekap terlebih dahulu', exact: true }).waitFor();
  assert.equal(await page.getByRole('columnheader').count(), 0);
  await page.getByRole('button', { name: 'Kembali ke rekap', exact: true }).click();
  await page.getByRole('tab', { name: 'Riwayat periode', exact: true }).click();
  assert.equal(await page.getByPlaceholder('Nama atau jabatan').count(), 0);
  await page.getByRole('tab', { name: 'Rekap penerima', exact: true }).click();
  pass('Review, payment and history are separate; draft payment is gated and filters are collapsed');
  await page.getByRole('checkbox', { name: `Pilih ${sample.name}`, exact: true }).check();
  assert.equal(await toolbar.getByRole('button').count(), 2);
  await toolbar.getByRole('button', { name: 'Kirim rekap absensi', exact: true }).waitFor();
  pass('Draft offers only attendance recap, with no transfer/slip button clutter');
  const row = page.locator('tbody tr').filter({ hasText: sample.name });
  await row.getByRole('button', { name: `Pratinjau slip ${sample.name}`, exact: true }).click();
  const frame = page.frameLocator('iframe[title="Pratinjau slip gaji Clevio"]');
  await frame.getByRole('heading', { name: 'Ringkasan penghasilan', exact: true }).waitFor();
  assert.equal(await frame.locator('tbody tr').count(), 8);
  const text = await frame.locator('body').innerText();
  for (const required of ['100 sesi', '2 sesi', '5 anak', 'Tunjangan jabatan', 'Tunjangan komunikasi', 'Transport November', 'Potongan November', 'Rp12.925.000']) assert.ok(text.includes(required), required);
  for (const hidden of ['Sesi kelas rahasia', '3 Nov', 'Detail sesi', 'Kelas dibatalkan']) assert.ok(!text.includes(hidden), hidden);
  assert.deepEqual(await frame.locator('thead th').allTextContents(), ['Komponen', 'Nominal']);
  await page.screenshot({ path: path.join(out, 'compact-slip-desktop.png') });
  await page.keyboard.press('Escape');
  await row.getByRole('button', { name: 'Rincian', exact: true }).click();
  const detail = page.getByRole('dialog', { name: `Rincian ${sample.name}`, exact: true });
  assert.equal(await detail.locator('tbody tr').count(), sample.lines.length);
  assert.equal(await detail.getByRole('button', { name: 'Tambah komponen', exact: true }).count(), 0);
  await detail.getByRole('button', { name: 'Tambahan / potongan', exact: true }).click();
  await detail.getByRole('button', { name: 'Tambah komponen', exact: true }).waitFor();
  await detail.getByRole('button', { name: 'Aktivitas manual', exact: true }).click();
  assert.equal(await detail.getByRole('button', { name: 'Tambah komponen', exact: true }).count(), 0);
  assert.equal(await detail.getByRole('button', { name: 'Aktivitas manual', exact: true }).getAttribute('aria-expanded'), 'true');
  await detail.getByRole('button', { name: 'Tutup rincian', exact: true }).click();
  pass('Recipient adjustment tools open on demand, one form at a time');
  pass('100 class sessions collapse to one fee row; every allowance/deduction remains; attendance detail stays complete');
  p.status = 'FINAL';
  p.history = [{ version: p.version, finalized_at: p.ends_at, finalized_by: 'qa', slips: structuredClone(p.slips) }];
  p.transfers = [{ id: 'qa-already-paid', profile_id: other.profile_id, amount: 1000000, at: p.ends_at, by: 'qa', reference: '', version: p.version }];
  await page.reload();
  await page.getByRole('tab', { name: 'Pembayaran & slip', exact: true }).waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Pembayaran & slip', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('checkbox', { name: `Pilih ${sample.name}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Pilih ${other.name}`, exact: true }).check();
  await toolbar.getByRole('button', { name: 'Tandai sudah transfer', exact: true }).click();
  await toolbar.getByRole('button', { name: 'Kirim slip gaji', exact: true }).waitFor();
  assert.deepEqual(commands[0].profileIds, [sample.profile_id]);
  assert.equal(await page.getByRole('checkbox', { name: `Pilih ${sample.name}`, exact: true }).isChecked(), true);
  assert.equal(await page.getByRole('checkbox', { name: `Pilih ${other.name}`, exact: true }).isChecked(), true);
  await toolbar.getByRole('button', { name: 'Kirim slip gaji', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'SIMULATED' }).waitFor();
  assert.deepEqual(commands[1].profileIds.sort(), [sample.profile_id, other.profile_id].sort());
  assert.equal(await page.getByRole('checkbox', { name: `Pilih ${sample.name}`, exact: true }).isChecked(), false);
  pass('Mixed selection marks only unpaid recipients, keeps both checked, then sends slips without reselection');
  await page.getByRole('tab', { name: 'Riwayat periode', exact: true }).click();
  await page.getByRole('button', { name: 'Buka revisi admin', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Rekap penerima', exact: true }).click();
  await page.getByRole('checkbox', { name: `Pilih ${sample.name}`, exact: true }).check();
  await toolbar.getByRole('button', { name: 'Kirim rekap absensi', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Pembayaran & slip', exact: true }).click();
  assert.equal(await toolbar.count(), 0);
  pass('Final periods open at payment; recap and admin revision stay accessible in their own areas');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(out, 'flow-payment-mobile.png'), fullPage: true });
  await row.getByRole('button', { name: `Pratinjau slip ${sample.name}`, exact: true }).click();
  await frame.getByRole('heading', { name: 'Ringkasan penghasilan', exact: true }).waitFor();
  assert.equal(await frame.locator('body').evaluate(e => e.scrollWidth <= e.ownerDocument.defaultView.innerWidth), true);
  await page.screenshot({ path: path.join(out, 'compact-slip-mobile.png') });
  assert.deepEqual(errors, []); assert.deepEqual(downloads, []);
  pass('Compact preview fits mobile with no console errors or downloads');
  // Transpile the exact production presentation modules for PDF visual QA.
  const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const moduleUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  const modelUrl = moduleUrl(compile('src/lib/payroll/model.ts'));
  const { renderPayrollHtml } = await import(moduleUrl(compile('src/lib/payroll/presentation.ts').replace(/from ['"]\.\/model['"]/, 'from ' + JSON.stringify(modelUrl))));
  const pdfPage = await browser.newPage();
  await pdfPage.setContent(renderPayrollHtml(p, sample, p.version, 'data:image/png;base64,' + fs.readFileSync('public/images/clevio-logo.png').toString('base64')));
  await pdfPage.pdf({ path: path.join(out, 'slip-compact.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  const archived = await context.request.get(base + '/api/admin/payroll?year=2026&month=8').then(r => r.json());
  const staff = archived.people.find(item => item.name === 'Staf QA Tanpa WA');
  const staffPdf = await context.request.get(base + `/api/payroll/2026-08/${staff.id}/pdf?version=1`);
  assert.equal(staffPdf.status(), 200);
  fs.writeFileSync(path.join(out, 'slip-components.pdf'), await staffPdf.body());
  pass('Generated compact class slip and real archived multi-component staff PDF without changing local finance data');
} finally {
  fs.writeFileSync(path.join(out, 'compact-results.json'), JSON.stringify({ checks, errors, downloads }, null, 2));
  await browser.close();
}
