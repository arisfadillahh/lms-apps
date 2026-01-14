import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');

        const { periodId } = await request.json();

        if (!periodId) {
            return NextResponse.json({ error: 'Period ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Calculate yesterday's date to ensure immediate expiry
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { error } = await supabase
            .from('coder_payment_periods')
            .update({
                status: 'EXPIRED',
                end_date: yesterdayStr
            })
            .eq('id', periodId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error stopping payment:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
