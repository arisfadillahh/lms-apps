import 'server-only';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { renderPayrollHtml } from '@/lib/payroll/presentation';
import type { PeriodDocument, Slip } from '@/lib/payroll/model';

export async function generatePayrollPdf(period: PeriodDocument, slip: Slip, version = period.version): Promise<Buffer> {
  const executablePath = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_BIN, process.env.CHROMIUM_PATH,
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => p && fs.existsSync(p));
  if (!executablePath) throw new Error('Chromium belum tersedia untuk membuat PDF slip.');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith('about:') || request.url().startsWith('data:') ? request.continue() : request.abort());
    await page.setContent(renderPayrollHtml(period, slip, version), { waitUntil: 'load', timeout: 20000 });
    await page.emulateMediaType('print');
    const buffer = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
      headerTemplate: '<span></span>', footerTemplate: '<div style="width:100%;text-align:center;font-size:8px;color:#51656f">Clevio LMS · <span class="pageNumber"></span> / <span class="totalPages"></span></div>', margin: { bottom: '18mm' } });
    return Buffer.from(buffer);
  } finally { await browser.close(); }
}
