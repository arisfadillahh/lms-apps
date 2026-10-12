import { test, expect, type Page } from '@playwright/test';

const evidence = '/workspace/codex-runs/qa-a2';
const classId = 'f300247f-4a3d-4bde-8d13-57251b99f2ea';
const sessionId = '475a1ba7-e89d-41eb-91c0-9d6cd02975b7';
const password = process.env.A2_TEST_PASSWORD ?? '';
if (!password) throw new Error('Set A2_TEST_PASSWORD for the local E2E fixture');

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function screenshot(page: Page, scenario: string) {
  const viewport = page.viewportSize()?.width === 390 ? 'mobile' : 'desktop';
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${evidence}/${scenario}-${viewport}.png`, fullPage: true });
}

test('admin roster includes inactive coder', async ({ page }) => {
  await login(page, 'a2-admin');
  await page.goto(`/admin/classes/${classId}`);
  const inactiveRow = page.getByRole('row').filter({ hasText: 'Coder Nonaktif Uji' }).filter({ hasText: 'Inactive' });
  await expect(inactiveRow).toBeVisible();
  await screenshot(page, 'admin-roster');
});

test('placement recommendation and transfer dialog', async ({ page }) => {
  await login(page, 'a2-admin');
  await page.goto('/admin/block-placements');
  await expect(page.getByRole('heading', { name: 'Penempatan Uji' }).first()).toBeVisible();
  await expect(page.getByText(/Rekomendasi:.*Digital Sabtu Uji/).first()).toBeVisible();
  await screenshot(page, 'placement-recommendation');
  await page.getByRole('button', { name: 'Pindahkan Penempatan Uji' }).first().click();
  await expect(page.getByRole('heading', { name: 'Pindahkan Penempatan Uji' }).first()).toBeVisible();
  await screenshot(page, 'transfer-dialog');
});

test('coach attendance includes Ahmad', async ({ page }) => {
  await login(page, 'a2-coach');
  await page.goto(`/coach/sessions/${sessionId}/attendance`);
  await expect(page.getByRole('main').getByText('Ahmad Uji').first()).toBeVisible();
  await screenshot(page, 'coach-attendance');
});

test('coder cannot open a PENDING block lesson', async ({ page }) => {
  await login(page, 'a2-ahmad');
  await page.goto('/coder/materials');
  await expect(page.getByRole('heading', { name: 'Interactive Uji' }).first()).toBeVisible();
  await expect(page.locator('a[href="/coder/materials/10000000-0000-4000-8000-000000000015"]').first()).toBeVisible();
  await page.getByRole('button', { name: /Belum Dimulai Digital Storytelling/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Digital Terkunci Uji' }).first()).toBeVisible();
  await expect(page.locator('a[href="/coder/materials/10000000-0000-4000-8000-000000000016"]')).toHaveCount(0);
  await screenshot(page, 'coder-materials');
  await page.goto('/coder/materials/10000000-0000-4000-8000-000000000016');
  await expect(page.getByText(/404|tidak ditemukan|not found/i).first()).toBeVisible();
  await screenshot(page, 'coder-pending-denied');
});
