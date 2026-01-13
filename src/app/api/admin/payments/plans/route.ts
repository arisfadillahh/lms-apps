import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const createPlanSchema = z.object({
    name: z.string().min(1).max(100),
    durationMonths: z.number().int().min(1).max(24),
    discountPercent: z.number().min(0).max(100).optional(),
});

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('payment_plans')
        .insert({
            name: parsed.data.name,
            duration_months: parsed.data.durationMonths,
            discount_percent: parsed.data.discountPercent ?? 0,
            is_active: true,
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Create Payment Plan] Error:', error);
        return NextResponse.json({ error: 'Gagal membuat paket' }, { status: 500 });
    }

    return NextResponse.json({ plan: data }, { status: 201 });
}

export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('payment_plans')
        .select('*')
        .order('duration_months', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
    }

    return NextResponse.json(data);
}
