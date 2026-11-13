import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import puppeteer from 'puppeteer-core';

const shared = process.argv[2];
if (!shared || !path.isAbsolute(shared)) throw new Error('Expected an absolute shared directory');
const executablePath = process.env.LMS_PAYMENT_BROWSER_PATH || chromium.executablePath();
if (!fs.existsSync(executablePath)) {
    if (process.env.LMS_PAYMENT_BROWSER_PATH) throw new Error('Configured payment browser is missing');
    const require = createRequire(import.meta.url);
    execFileSync(process.execPath, [path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js'),
        'install', '--with-deps', 'chromium'], { stdio:'inherit', timeout:300000 });
}
const browser=await puppeteer.launch({executablePath,headless:true,args:process.getuid?.()===0?['--no-sandbox','--disable-dev-shm-usage']:[]});
try { console.log('Payment browser ready:',await browser.version()); } finally { await browser.close(); }
const directory=path.join(shared,'.data');
fs.mkdirSync(directory,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(directory,'payment-browser.json'),JSON.stringify({executablePath}),{mode:0o600});
