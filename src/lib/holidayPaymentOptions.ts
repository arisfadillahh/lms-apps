import type { PublicInvoicePaymentOption } from './invoicePaymentMethods';

const order=['qris','bni_va','bri_va'];
export function orderHolidayPaymentOptions(options:PublicInvoicePaymentOption[]) {
  return options.filter(o=>!o.disabled).sort((a,b)=>{
    const rank=(code:string)=>order.includes(code)?order.indexOf(code):3;
    return rank(a.code)-rank(b.code);
  });
}
export function holidayFallbackVa(options:PublicInvoicePaymentOption[]) {
  return orderHolidayPaymentOptions(options).find(o=>o.code==='bni_va'||o.code==='bri_va'||o.code.endsWith('_va'))??null;
}

/** Merchant flags are necessary, not sufficient: only verified adapters may be advertised. */
export function holidayWalletConfig(env:Record<string,string|undefined>,readyAdapters:readonly string[]=[]) {
  return ['gopay','shopeepay'].map(code=>({code,
    merchantEnabled:env[`HOLIDAY_${code.toUpperCase()}_ENABLED`]==='true',
    available:env[`HOLIDAY_${code.toUpperCase()}_ENABLED`]==='true'&&readyAdapters.includes(code),
  }));
}
