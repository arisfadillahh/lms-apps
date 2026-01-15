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

const updatePlanSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    durationMonths: z.number().int().min(1).max(24),
    discountPercent: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
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

export async function PUT(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('payment_plans')
        .update({
            name: parsed.data.name,
            duration_months: parsed.data.durationMonths,
            discount_percent: parsed.data.discountPercent ?? 0,
            is_active: parsed.data.isActive ?? true,
        })
        .eq('id', parsed.data.id)
        .select('*')
        .single();

    if (error) {
        console.error('[Update Payment Plan] Error:', error);
        return NextResponse.json({ error: 'Gagal mengupdate paket' }, { status: 500 });
    }

    return NextResponse.json({ plan: data });
}

export async function DELETE(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID paket tidak ditemukan' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if the plan is being used by any coder_payment_periods
    const { count } = await supabase
        .from('coder_payment_periods')
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', id);

    if (count && count > 0) {
        return NextResponse.json({
            error: 'Paket ini sudah digunakan oleh siswa dan tidak dapat dihapus. Nonaktifkan saja jika tidak ingin digunakan lagi.'
        }, { status: 400 });
    }

    const { error } = await supabase
        .from('payment_plans')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Delete Payment Plan] Error:', error);
        return NextResponse.json({ error: 'Gagal menghapus paket' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
