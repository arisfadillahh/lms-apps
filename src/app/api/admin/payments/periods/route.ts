import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const createPeriodSchema = z.object({
    coderId: z.string().uuid(),
    paymentPlanId: z.string().uuid(),
    pricingId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(),
    totalAmount: z.number().min(0),
    classId: z.string().uuid().optional(),
});

const updatePeriodSchema = z.object({
    periodId: z.string().uuid(),
    paymentPlanId: z.string().uuid(),
    pricingId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(),
    totalAmount: z.number().min(0),
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

    const parsed = createPeriodSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get coder's active class if not provided
    let classId = parsed.data.classId;
    if (!classId) {
        const { data: enrollments } = await supabase
            .from('enrollments')
            .select(`
                class_id,
                classes ( type )
            `)
            .eq('coder_id', parsed.data.coderId)
            .eq('status', 'ACTIVE');

        if (enrollments && enrollments.length > 0) {
            // Priority: Non-EKSKUL class (e.g. WEEKLY)
            const mainClass = enrollments.find(e => e.classes?.type !== 'EKSKUL');
            classId = mainClass ? mainClass.class_id : enrollments[0].class_id;
        }
    }

    if (!classId) {
        return NextResponse.json({ error: 'Coder tidak memiliki kelas aktif' }, { status: 400 });
    }

    // Expire any existing active periods for this coder
    await supabase
        .from('coder_payment_periods')
        .update({ status: 'EXPIRED' })
        .eq('coder_id', parsed.data.coderId)
        .eq('status', 'ACTIVE');

    // Create new payment period
    const { data, error } = await supabase
        .from('coder_payment_periods')
        .insert({
            coder_id: parsed.data.coderId,
            class_id: classId,
            payment_plan_id: parsed.data.paymentPlanId,
            pricing_id: parsed.data.pricingId,
            start_date: parsed.data.startDate,
            end_date: parsed.data.endDate,
            total_amount: parsed.data.totalAmount,
            status: 'ACTIVE',
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Create Payment Period] Error:', error);
        return NextResponse.json({ error: 'Gagal menyimpan periode' }, { status: 500 });
    }

    return NextResponse.json({ period: data }, { status: 201 });
}

export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('coder_payment_periods')
        .select('*, users!coder_payment_periods_coder_id_fkey(full_name), payment_plans(*), pricing(*)')
        .order('end_date', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
    }

    return NextResponse.json(data);
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

    const parsed = updatePeriodSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('coder_payment_periods')
        .update({
            payment_plan_id: parsed.data.paymentPlanId,
            pricing_id: parsed.data.pricingId,
            start_date: parsed.data.startDate,
            end_date: parsed.data.endDate,
            total_amount: parsed.data.totalAmount,
            // Status stays same, likely ACTIVE if we are editing it
        })
        .eq('id', parsed.data.periodId)
        .select('*')
        .single();

    if (error) {
        console.error('[Update Payment Period] Error:', error);
        return NextResponse.json({ error: 'Gagal update periode' }, { status: 500 });
    }

    return NextResponse.json({ period: data }, { status: 200 });
}
