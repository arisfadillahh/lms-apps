import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const createPricingSchema = z.object({
    pricingType: z.enum(['WEEKLY', 'SEASONAL']).default('WEEKLY'),
    levelId: z.string().uuid().optional(),
    seasonalName: z.string().min(2).optional(),
    mode: z.enum(['ONLINE', 'OFFLINE']),
    basePriceMonthly: z.number().min(0),
}).refine((data) => {
    if (data.pricingType === 'WEEKLY' && !data.levelId) {
        return false;
    }
    if (data.pricingType === 'SEASONAL' && !data.seasonalName) {
        return false;
    }
    return true;
}, {
    message: 'Weekly pricing requires level, Seasonal pricing requires name'
});

const updatePricingSchema = z.object({
    id: z.string().uuid(),
    pricingType: z.enum(['WEEKLY', 'SEASONAL']).default('WEEKLY'),
    levelId: z.string().uuid().optional().nullable(),
    seasonalName: z.string().min(2).optional().nullable(),
    mode: z.enum(['ONLINE', 'OFFLINE']),
    basePriceMonthly: z.number().min(0),
    isActive: z.boolean().optional(),
}).refine((data) => {
    if (data.pricingType === 'WEEKLY' && !data.levelId) {
        return false;
    }
    if (data.pricingType === 'SEASONAL' && !data.seasonalName) {
        return false;
    }
    return true;
}, {
    message: 'Weekly pricing requires level, Seasonal pricing requires name'
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

    // Cast to any because supabase-js generic types don't account for dynamic column selection/insertion very well with nullable checks
    const supabase = getSupabaseAdmin() as any;

    // Check for existing pricing with same level + mode OR seasonal name + mode
    let query = supabase
        .from('pricing')
        .select('id')
        .eq('mode', parsed.data.mode)
        .eq('pricing_type', parsed.data.pricingType);

    if (parsed.data.pricingType === 'WEEKLY') {
        query = query.eq('level_id', parsed.data.levelId);
    } else {
        query = query.eq('seasonal_name', parsed.data.seasonalName);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Harga untuk paket ini sudah ada' }, { status: 409 });
    }

    const { data, error } = await supabase
        .from('pricing')
        .insert({
            pricing_type: parsed.data.pricingType,
            level_id: parsed.data.levelId || null,
            seasonal_name: parsed.data.seasonalName || null,
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

    const supabase = getSupabaseAdmin() as any;

    // Check for duplicate level + mode OR seasonal name + mode (excluding current entry)
    let query = supabase
        .from('pricing')
        .select('id')
        .eq('mode', parsed.data.mode)
        .eq('pricing_type', parsed.data.pricingType)
        .neq('id', parsed.data.id);

    if (parsed.data.pricingType === 'WEEKLY') {
        query = query.eq('level_id', parsed.data.levelId);
    } else {
        query = query.eq('seasonal_name', parsed.data.seasonalName);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
        return NextResponse.json({ error: 'Harga untuk paket ini sudah ada' }, { status: 409 });
    }

    const { data, error } = await supabase
        .from('pricing')
        .update({
            pricing_type: parsed.data.pricingType,
            level_id: parsed.data.levelId || null,
            seasonal_name: parsed.data.seasonalName || null,
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
