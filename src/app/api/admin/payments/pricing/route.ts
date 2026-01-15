import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const createPricingSchema = z.object({
    levelId: z.string().uuid(),
    mode: z.enum(['ONLINE', 'OFFLINE']),
    basePriceMonthly: z.number().min(0),
});

const updatePricingSchema = z.object({
    id: z.string().uuid(),
    levelId: z.string().uuid(),
    mode: z.enum(['ONLINE', 'OFFLINE']),
    basePriceMonthly: z.number().min(0),
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

    const parsed = createPricingSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check for existing pricing with same level + mode
    const { data: existing } = await supabase
        .from('pricing')
        .select('id')
        .eq('level_id', parsed.data.levelId)
        .eq('mode', parsed.data.mode)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Harga untuk level dan mode ini sudah ada' }, { status: 409 });
    }

    const { data, error } = await supabase
        .from('pricing')
        .insert({
            level_id: parsed.data.levelId,
            mode: parsed.data.mode,
            base_price_monthly: parsed.data.basePriceMonthly,
            is_active: true,
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Create Pricing] Error:', error);
        return NextResponse.json({ error: 'Gagal menyimpan harga' }, { status: 500 });
    }

    return NextResponse.json({ pricing: data }, { status: 201 });
}

export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('pricing')
        .select('*')
        .order('created_at', { ascending: false });

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

    const parsed = updatePricingSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check for duplicate level + mode (excluding current entry)
    const { data: existing } = await supabase
        .from('pricing')
        .select('id')
        .eq('level_id', parsed.data.levelId)
        .eq('mode', parsed.data.mode)
        .neq('id', parsed.data.id)
        .maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Harga untuk level dan mode ini sudah ada' }, { status: 409 });
    }

    const { data, error } = await supabase
        .from('pricing')
        .update({
            level_id: parsed.data.levelId,
            mode: parsed.data.mode,
            base_price_monthly: parsed.data.basePriceMonthly,
            is_active: parsed.data.isActive ?? true,
        })
        .eq('id', parsed.data.id)
        .select('*')
        .single();

    if (error) {
        console.error('[Update Pricing] Error:', error);
        return NextResponse.json({ error: 'Gagal mengupdate harga' }, { status: 500 });
    }

    return NextResponse.json({ pricing: data });
}

export async function DELETE(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID harga tidak ditemukan' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
        .from('pricing')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[Delete Pricing] Error:', error);
        return NextResponse.json({ error: 'Gagal menghapus harga' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
