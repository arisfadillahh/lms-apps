import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import type { MidtransChargeResponse } from '@/lib/invoiceMidtransClient';

const processState=globalThis as typeof globalThis & { __clevioSnapBrowserSlots?: {running:number} };
const slots=processState.__clevioSnapBrowserSlots??={running:0};
const MAX_BROWSERS = 2;

export function paymentBrowserPath() {
    const configured = [process.env.LMS_PAYMENT_BROWSER_PATH, process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_BIN];
    try {
        const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.data', 'payment-browser.json'), 'utf8'));
        configured.push(config.executablePath);
    } catch { /* Local development can use an installed browser. */ }
    return [...configured, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => typeof p === 'string' && fs.existsSync(p));
}

/** Let the real checkout issue its instructions. Never replay its signed requests. */
export async function issueSnapInBrowser(token: string, production: boolean): Promise<MidtransChargeResponse> {
    if (!/^[a-zA-Z0-9-]{8,100}$/.test(token)) throw new Error('Token pembayaran tidak valid.');
    if (slots.running >= MAX_BROWSERS) throw new Error('Pembayaran sedang ramai. Coba kembali sebentar lagi.');
    const executablePath = paymentBrowserPath();
    if (!executablePath) throw new Error('Layanan instruksi pembayaran belum siap. Hubungi admin.');
    slots.running++;
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
    try {
        browser = await puppeteer.launch({ executablePath, headless: true,
            args: [...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []), '--disable-dev-shm-usage'],
            timeout: 12000 });
        const page = await browser.newPage();
        let transaction: {order_id?:string;gross_amount?:string}={};
        const origin = production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
        await page.setRequestInterception(true);
        page.on('request', request => {
            const u = new URL(request.url());
            const allowed = ['about:', 'data:', 'blob:'].includes(u.protocol)
                || (u.protocol === 'https:' && (u.hostname === 'midtrans.com' || u.hostname.endsWith('.midtrans.com')));
            void (allowed ? request.continue() : request.abort()).catch(() => {});
        });
        // Start listening BEFORE navigation: a single enabled channel issues automatically.
        const issued = page.waitForResponse(async response => {
            const u = new URL(response.url());
            if (u.origin !== origin || !new RegExp(`^/snap/v[1-4]/transactions/${token}(?:/[^?]*)?$`).test(u.pathname) || !response.ok()) return false;
            const payload=await response.json().catch(()=>null);
            if(payload?.transaction_details)transaction=payload.transaction_details;
            const data = unwrapSnapResponse(payload);
            return (data?.transaction_status === 'pending' || data?.status_code === '201')
                && !!(data?.order_id||transaction.order_id) && !!(data?.gross_amount||transaction.gross_amount);
        }, { timeout: 25000 });
        // A navigation failure must not produce an unhandled waiter rejection.
        void issued.catch(() => {});
        await page.goto(`${origin}/snap/v4/redirection/${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const response = await issued;
        const data=unwrapSnapResponse(await response.json())!;
        return {...data,order_id:data.order_id||transaction.order_id,gross_amount:data.gross_amount||transaction.gross_amount};
    } catch {
        // Do not print the provider page URL, customer fields, token, or raw error.
        throw new Error('Instruksi belum dapat dikonfirmasi. Coba lagi untuk melanjutkan pembayaran yang sama.');
    } finally {
        try {
            if(browser){
                const owned=browser;
                let timer:ReturnType<typeof setTimeout>|undefined;
                try {
                    await Promise.race([owned.close().catch(()=>{owned.process()?.kill('SIGKILL');}),
                        new Promise<void>(resolve=>{timer=setTimeout(()=>{owned.process()?.kill('SIGKILL');resolve();},3000);})]);
                } finally {if(timer)clearTimeout(timer);}
            }
        } finally { slots.running--; }
    }
}

/** A resumed checkout carries its existing instructions under result. */
export function unwrapSnapResponse(value: unknown): MidtransChargeResponse | null {
    if (!value || typeof value!=='object')return null;
    const p=value as Record<string,unknown>;
    if(p.result&&typeof p.result==='object'&&p.transaction_details&&typeof p.transaction_details==='object'){
        const t=p.transaction_details as Record<string,unknown>;
        const result=p.result as MidtransChargeResponse;
        return {...result,order_id:String(t.order_id??''),gross_amount:String(t.gross_amount??''),
            expiry_time:result.expiry_time || result.qris_expiration_raw || result.bsi_expiration_raw
                || (typeof p.expiry_time==='string'?p.expiry_time:undefined)};
    }
    return p as MidtransChargeResponse;
}
