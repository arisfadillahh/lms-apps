import { describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { applyInvoiceFilters, invoiceDateRange } from './invoiceDateFilter';
import type { InvoiceFilters } from './types/invoice';

async function filterParams(filters: InvoiceFilters) {
    let params = new URLSearchParams();
    const client = createClient('https://invoice.test', 'test-key', {
        global: {
            fetch: async (input) => {
                params = new URL(String(input)).searchParams;
                return Response.json([]);
            }
        }
    });
    const query = client.from('invoices').select('id');
    await applyInvoiceFilters<typeof query>(query, filters);
    params.delete('select');
    return Object.fromEntries([...new Set(params.keys())].map(key => [key, params.getAll(key)]));
}

describe('invoice date filters', () => {
    it('includes an invoice issued in November WIB regardless of its class period', async () => {
        expect(await filterParams({ dateBasis: 'issued', year: 2026, month: 11 })).toEqual({
            created_at: ['gte.2026-10-31T17:00:00.000Z', 'lt.2026-11-30T17:00:00.000Z']
        });
    });

    it('preserves month-only class-period filtering for existing callers', async () => {
        expect(await filterParams({ month: 12 })).toEqual({ period_month: ['eq.12'] });
    });

    it('filters confirmed payments by payment time and retains invoice-number search', async () => {
        expect(await filterParams({ dateBasis: 'paid', year: 2026, month: 12, search: 'HC-2627' })).toEqual({
            status: ['eq.PAID'],
            paid_at: ['not.is.null', 'gte.2026-11-30T17:00:00.000Z', 'lt.2026-12-31T17:00:00.000Z'],
            or: ['(invoice_number.ilike."%HC-2627%",parent_name.ilike."%HC-2627%")']
        });
    });

    it('uses WIB boundaries for an entire year', () => {
        expect(invoiceDateRange(2026)).toEqual({
            start: '2025-12-31T17:00:00.000Z',
            end: '2026-12-31T17:00:00.000Z'
        });
    });
});
