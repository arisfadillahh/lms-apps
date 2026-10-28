// Synthetic inputs only: no application environment, DB, WhatsApp socket or send.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import bcrypt from 'bcrypt';
import { generateProfilePicture } from '@whiskeysockets/baileys';
import puppeteer from 'puppeteer-core';

const png = await sharp({ create: { width: 32, height: 16, channels: 4, background: '#183b78' } }).png().toBuffer();
const { img } = await generateProfilePicture(png, { width: 64, height: 64 });
const metadata = await sharp(img).metadata();
assert.equal(metadata.format, 'jpeg');
assert.deepEqual([metadata.width, metadata.height], [64, 64]);
const passwordHash = await bcrypt.hash('synthetic-runtime-check', 4);
assert.equal(await bcrypt.compare('synthetic-runtime-check', passwordHash), true);
assert.equal(await bcrypt.compare('different-synthetic-value', passwordHash), false);

const configured = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_BIN ?? process.env.CHROMIUM_PATH;
const executablePath = configured || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/snap/bin/chromium'].find(filename => fs.existsSync(filename));
let pdf = 'browser-unavailable';
if (executablePath) {
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => { if (/^(about:|data:)/.test(request.url())) void request.continue(); else void request.abort(); });
    await page.setContent('<!doctype html><html><head><title>Runtime regression</title></head><body><h1>Synthetic LMS runtime check</h1><p>No production data.</p></body></html>', { waitUntil: 'load' });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 });
    await page.emulateMediaType('screen');
    const bytes = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 1000);
    pdf = 'passed';
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ node: process.version, whatsappImage: 'passed', nativePassword: 'passed', pdf, productionDataUsed: false }));
