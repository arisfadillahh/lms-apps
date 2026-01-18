/**
 * CCR API - Edit Endpoint
 * PATCH /api/ccr/[id] - Update CCR record
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = await props.params;
        const id = params.id;
        const body = await request.json();
        const { ccr_code, parent_name } = body;

        if (!ccr_code) {
            return NextResponse.json({ error: 'ccr_code is required' }, { status: 400 });
        }

        // Validate CCR format
        if (!/^CCR[0-9]{3,}$/.test(ccr_code)) {
            return NextResponse.json(
                { error: 'Invalid format. Must be CCR followed by at least 3 digits (e.g., CCR001)' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        // Check if new code already exists (for different record)
        const { data: existing } = await supabase
            .from('ccr_numbers' as any)
            .select('id')
            .eq('ccr_code', ccr_code)
            .neq('id', id)
            .single();

        if (existing) {
            return NextResponse.json(
                { error: 'ID Invoice ini sudah digunakan oleh keluarga lain' },
                { status: 400 }
            );
        }

        // Extract sequence number
        const sequence = parseInt(ccr_code.substring(3), 10);

        // Update record
        const { data, error } = await supabase
            .from('ccr_numbers' as any)
            .update({
                ccr_code,
                ccr_sequence: sequence,
                parent_name: parent_name || undefined
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[API] CCR update error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, ccr: data });

    } catch (error) {
        console.error('[API] CCR update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
