import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseServer', () => ({
    getSupabaseAdmin: vi.fn(),
}));

vi.mock('@/lib/services/invoicePublicAccess', () => ({
    buildInvoicePublicUrl: vi.fn(),
}));

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assignCCRToParent } from '@/lib/dao/invoicesDao';

type CCR = {
    id: string;
    parent_phone: string;
    parent_name: string;
    ccr_code: string;
    ccr_sequence: number;
};

function makeSupabaseMock(options: {
    existingCode?: CCR | null;
    existingParent?: CCR | null;
    updatedCCR?: CCR | null;
    updateError?: { message: string } | null;
}) {
    const updateCalls: Array<Record<string, unknown>> = [];
    const from = vi.fn((table: string) => {
        let operation: 'select' | 'update' | null = null;
        const filters: Record<string, unknown> = {};
        const builder: Record<string, any> = {
            select: vi.fn(() => {
                if (operation !== 'update') operation = 'select';
                return builder;
            }),
            update: vi.fn((payload: Record<string, unknown>) => {
                operation = 'update';
                updateCalls.push(payload);
                return builder;
            }),
            eq: vi.fn((column: string, value: unknown) => {
                filters[`${table}.${column}`] = value;
                return builder;
            }),
            single: vi.fn(async () => {
                if (operation === 'update') {
                    return { data: options.updatedCCR ?? null, error: options.updateError ?? null };
                }

                if (table === 'ccr_numbers' && filters['ccr_numbers.ccr_code']) {
                    return { data: options.existingCode ?? null, error: null };
                }

                return { data: options.existingParent ?? null, error: null };
            }),
        };
        return builder;
    });

    return { supabase: { from }, updateCalls };
}

describe('CCR assignment updates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates an existing parent CCR instead of returning the stale value', async () => {
        const existingParent: CCR = {
            id: 'parent-1',
            parent_phone: '6281200000000',
            parent_name: 'Orang Tua Test',
            ccr_code: 'CCR1004',
            ccr_sequence: 1004,
        };
        const updatedCCR: CCR = { ...existingParent, ccr_code: 'CCR079', ccr_sequence: 79 };
        const fixture = makeSupabaseMock({ existingParent, updatedCCR });
        vi.mocked(getSupabaseAdmin).mockReturnValue(fixture.supabase as any);

        const result = await assignCCRToParent(
            existingParent.parent_phone,
            ' ccr079 ',
            existingParent.parent_name,
        );

        expect(result).toEqual(updatedCCR);
        expect(fixture.updateCalls).toEqual([{
            ccr_code: 'CCR079',
            ccr_sequence: 79,
            parent_name: existingParent.parent_name,
        }]);
    });

    it('rejects a CCR already owned by another parent', async () => {
        const fixture = makeSupabaseMock({
            existingCode: {
                id: 'other-parent',
                parent_phone: '6281299999999',
                parent_name: 'Other Parent',
                ccr_code: 'CCR079',
                ccr_sequence: 79,
            },
            existingParent: {
                id: 'parent-1',
                parent_phone: '6281200000000',
                parent_name: 'Orang Tua Test',
                ccr_code: 'CCR1004',
                ccr_sequence: 1004,
            },
        });
        vi.mocked(getSupabaseAdmin).mockReturnValue(fixture.supabase as any);

        const result = await assignCCRToParent('6281200000000', 'CCR079');

        expect(result).toBeNull();
        expect(fixture.updateCalls).toHaveLength(0);
    });
});
