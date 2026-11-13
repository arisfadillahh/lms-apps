import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { unwrapSnapResponse } from '@/lib/invoiceSnapBrowser';

describe('provider instruction response shapes',()=>{
    it('preserves the issued QR expiry instead of extending it to the Snap checkout lifetime',()=>{
        expect(unwrapSnapResponse({transaction_details:{order_id:'LOCAL',gross_amount:'10000'},expiry_time:'2026-11-14 00:00:00 +0000',
            result:{transaction_status:'pending',qris_expiration_raw:'2026-11-13 10:15:00 +0700',qr_string:'qr-payload'}}))
            .toMatchObject({order_id:'LOCAL',gross_amount:'10000',expiry_time:'2026-11-13 10:15:00 +0700',qr_string:'qr-payload'});
    });
    it('accepts the initial BSI response with code 201 while keeping all financial identity fields intact',()=>{
        const result={status_code:'201',payment_type:'bank_transfer',order_id:'LOCAL',gross_amount:'10000',bsi_va_number:'20201234567890123',transaction_id:'snap-placeholder-bsi'};
        expect(unwrapSnapResponse(result)).toEqual(result);
    });
    it('recovers existing BSI instructions from a reopened checkout without issuing another order',()=>{
        expect(unwrapSnapResponse({transaction_details:{order_id:'LOCAL',gross_amount:'10000'},expiry_time:'2026-11-13 03:30:00 +0000',
            result:{transaction_status:'pending',bsi_va_number:'20201234567890123'}})).toMatchObject({order_id:'LOCAL',gross_amount:'10000',transaction_status:'pending',bsi_va_number:'20201234567890123'});
    });
});
