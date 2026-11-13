import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { InvoiceMidtransPayment } from '@/lib/invoiceMidtransClient';

export type IssuanceJournal = {
    invoiceId: string;
    orderId: string;
    method: string;
    total: number;
    phase: 'CREATING' | 'SNAP_READY' | 'READY' | 'REJECTED';
    token?: string;
    payment?: InvoiceMidtransPayment;
};
const localLocks = new Set<string>();

export function issuanceRoot() {
    return process.env.LMS_INVOICE_ISSUANCE_DIR || path.join(process.env.LMS_INVOICE_PAYMENT_STORE_DIR
        || path.join(process.cwd(), '.data', 'invoice-payments'), 'issuance');
}

export async function getIssuanceByOrder(orderId: string): Promise<IssuanceJournal | null> {
    const key=createHash('sha256').update(orderId).digest('hex');
    try { const s=JSON.parse(await readFile(path.join(issuanceRoot(),'orders',`${key}.json`),'utf8'));
        if(s.orderId!==orderId)throw new Error('Order mismatch');return s;
    } catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}

async function lockInvoice(file: string) {
    if(process.platform==='linux') {
        const h=await open(file,'a',0o600);await h.close();
        // Kernel lock is released even on a worker crash. No timestamp-based lock stealing.
        const child=spawn('flock',['-n',file,process.execPath,'-e',
            "process.stdout.write('LOCKED\\n');process.stdin.resume();process.stdin.on('end',()=>process.exit(0));"],{stdio:['pipe','pipe','ignore']});
        try {
            await new Promise<void>((resolve,reject)=>{
                const timer=setTimeout(()=>{child.kill();reject(new Error('lock timeout'));},5000);
                child.once('error',e=>{clearTimeout(timer);reject(e);});
                child.once('exit',()=>{clearTimeout(timer);reject(new Error('lock busy'));});
                child.stdout.once('data',data=>{clearTimeout(timer);if(String(data).trim()==='LOCKED')resolve();else reject(new Error('lock unavailable'));});
            });
        } catch {child.stdin.end();throw new Error('Instruksi pembayaran sedang dibuat. Tunggu sebentar lalu coba kembali.');}
        return async()=>{child.stdin.end();await new Promise<void>(resolve=>{
            const timer=setTimeout(()=>{child.kill();resolve();},2000);child.once('exit',()=>{clearTimeout(timer);resolve();});
        });};
    }
    // Local development fallback. A live owner's lock is never removed.
    const owner=`${process.pid}:${randomUUID()}`;
    try {const h=await open(file,'wx',0o600);await h.writeFile(owner);await h.close();}
    catch {throw new Error('Instruksi pembayaran sedang dibuat. Tunggu sebentar lalu coba kembali.');}
    return async()=>{if(await readFile(file,'utf8').catch(()=>'')===owner)await unlink(file);};
}

/** Cross-process single-host lock; a live worker's lock is never stolen on timeout. */
export async function withInvoiceIssuance<T>(invoiceId: string, run: (journal: {
    read: () => Promise<IssuanceJournal | null>;
    write: (state: IssuanceJournal) => Promise<void>;
}) => Promise<T>): Promise<T> {
    const key = createHash('sha256').update(invoiceId).digest('hex');
    if (localLocks.has(key)) throw new Error('Instruksi pembayaran sedang dibuat. Tunggu sebentar lalu coba kembali.');
    localLocks.add(key);
    try {
    const root = issuanceRoot();
    await mkdir(root, { recursive: true, mode: 0o700 });
    const lock = path.join(root, `${key}.lock`), file = path.join(root, `${key}.json`);
    const release=await lockInvoice(lock);
    try {
        return await run({
            read: async () => {
                try {
                    const state = JSON.parse(await readFile(file, 'utf8')) as IssuanceJournal;
                    if (state.invoiceId !== invoiceId || !state.orderId || !['CREATING','SNAP_READY','READY','REJECTED'].includes(state.phase)) throw new Error('Invalid journal');
                    return state;
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
                    throw new Error('Riwayat pembuatan pembayaran perlu diperiksa admin.');
                }
            },
            write: async state => {
                const tmp = `${file}.${randomUUID()}.tmp`;
                await writeFile(tmp, JSON.stringify(state), { mode: 0o600 });
                await rename(tmp, file);
                const orders=path.join(root,'orders');await mkdir(orders,{recursive:true,mode:0o700});
                const orderFile=path.join(orders,`${createHash('sha256').update(state.orderId).digest('hex')}.json`);
                const orderTmp=`${orderFile}.${randomUUID()}.tmp`;
                await writeFile(orderTmp,JSON.stringify(state),{mode:0o600});await rename(orderTmp,orderFile);
            },
        });
    } finally {
        await release();
    }
    } finally { localLocks.delete(key); }
}
