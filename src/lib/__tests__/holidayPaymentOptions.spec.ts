import {describe,it,expect} from 'vitest';
import {getPublicInvoicePaymentOptions,getInvoicePaymentOption} from '@/lib/invoicePaymentMethods';
import {orderHolidayPaymentOptions,holidayFallbackVa,holidayWalletConfig} from '@/lib/holidayPaymentOptions';
describe('Holiday payment priority and feature gates',()=>{
  it('puts QRIS then BNI and BRI first without mutating ordinary options',()=>{
    const original=getPublicInvoicePaymentOptions(350000),snapshot=JSON.stringify(original);
    expect(orderHolidayPaymentOptions(original).slice(0,3).map(o=>o.code)).toEqual(['qris','bni_va','bri_va']);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(orderHolidayPaymentOptions(original).every(o=>o.adminFee===2500&&o.total===352500)).toBe(true);
  });
  it('selects a VA fallback and excludes disabled QRIS',()=>{
    const options=getPublicInvoicePaymentOptions(350000).map(o=>o.code==='qris'?{...o,disabled:true}:o);
    expect(orderHolidayPaymentOptions(options)[0].code).toBe('bni_va');
    expect(holidayFallbackVa(options)?.code).toBe('bni_va');
    expect(holidayFallbackVa([])).toBeNull();
  });
  it('requires both merchant activation and a verified adapter, never enabling monthly wallets',()=>{
    expect(holidayWalletConfig({}).every(w=>!w.available)).toBe(true);
    expect(holidayWalletConfig({HOLIDAY_GOPAY_ENABLED:'true'})[0]).toMatchObject({merchantEnabled:true,available:false});
    expect(holidayWalletConfig({HOLIDAY_GOPAY_ENABLED:'true'},['gopay'])[0].available).toBe(true);
    expect(getInvoicePaymentOption('gopay')).toBeNull();
  });
});
