// Explicit operator-run production probe. Never invoked by deployment or cron.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { Module, createRequire } from 'node:module';
import ts from 'typescript';

if (!process.argv.includes('--allow-production-gateway-probe') || process.env.MIDTRANS_IS_PRODUCTION !== 'true') {
    throw new Error('Requires explicit --allow-production-gateway-probe and the production environment');
}

// Run the exact released server sources without exposing a public testing API.
const cache=new Map();
function loadSource(file) {
    if(cache.has(file))return cache.get(file).exports;
    const mod=new Module(file);cache.set(file,mod);mod.filename=file;
    const nativeRequire=createRequire(file);
    mod.require=name=>{
        if(name==='server-only')return {};
        if(name.startsWith('@/'))return loadSource(path.resolve('src',name.slice(2)+'.ts'));
        return nativeRequire(name);
    };
    const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
    mod._compile(output.outputText,file);return mod.exports;
}

const runtimeConfig=path.resolve('.data/payment-browser.json');
if(!fs.existsSync(runtimeConfig))throw new Error('Payment browser has not been provisioned');
process.env.LMS_PAYMENT_BROWSER_PATH=JSON.parse(fs.readFileSync(runtimeConfig,'utf8')).executablePath;
const root=await fsp.mkdtemp(path.join(os.tmpdir(),'clevio-gateway-probe-'));
process.env.LMS_INVOICE_PAYMENT_STORE_DIR=path.join(root,'payments');
process.env.LMS_INVOICE_ISSUANCE_DIR=path.join(root,'issuance');
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{
    if(String(url)==='https://app.midtrans.com/snap/v1/transactions'){
        const body=JSON.parse(init.body);
        if(!body.transaction_details.order_id.startsWith('QA-RUNTIME-'))throw new Error('Not a QA order');
        body.expiry={unit:'minutes',duration:5};
        init={...init,body:JSON.stringify(body)};
    }
    return originalFetch(url,init);
};
const {InvoiceMidtransClient}=loadSource(path.resolve('src/lib/invoiceMidtransClient.ts'));
const {buildInvoicePaymentBreakdown}=loadSource(path.resolve('src/lib/invoicePaymentMethods.ts'));
const {renderInvoicePaymentQr}=loadSource(path.resolve('src/lib/invoicePaymentQr.ts'));
const results=[];
try {
    for(const method of ['qris','bni_va',...(process.argv.includes('--include-bsi')?['bsi_va']:[])]){
        const order=`QA-RUNTIME-${method}-${randomUUID().slice(0,12)}`;
        const invoice={id:order,invoice_number:order,status:'PENDING',total_amount:7500,parent_name:'Clevio Technical QA',items:[]};
        const payment=buildInvoicePaymentBreakdown(method,7500);
        const client=new InvoiceMidtransClient();
        let result={method,order,amount:10000};
        try {
            const first=await client.createPayment(invoice,payment,order);
            const second=await client.createPayment(invoice,payment,order+'-UNUSED');
            if(second.orderId!==order||first.paymentDetails.total!==10000)throw new Error('Invoice identity mismatch');
            if(method==='qris')result.pngBytes=(await renderInvoicePaymentQr(first.paymentDetails)).length;
            else if(!first.paymentDetails.vaNumber||first.paymentDetails.bank!==(method==='bsi_va'?'bsi':'bni'))throw new Error('Invalid bank instruction');
            result.issued=true;result.reused=true;
        } finally {
            let status=await client.getTransactionStatus(order).catch(()=>null);
            if(status?.transaction_status==='pending'){
                await client.cancelTransaction(order);status=await client.getTransactionStatus(order);
            }
            result.finalStatus=status?.transaction_status??'NO_INSTRUCTION';results.push(result);
            console.log(JSON.stringify(result));
            if(!['cancel','expire'].includes(result.finalStatus))throw new Error('Probe cleanup requires attention');
        }
    }
} finally {
    globalThis.fetch=originalFetch;
    // Keep only if cleanup failed, so an operator can reconcile its order safely.
    if(results.every(r=>r.finalStatus==='cancel'))await fsp.rm(root,{recursive:true,force:true});
    else console.log('Probe journal retained:',root);
}
