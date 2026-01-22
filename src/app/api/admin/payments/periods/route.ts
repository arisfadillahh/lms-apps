import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getOrCreateCCR } from '@/lib/dao/invoicesDao';

const createPeriodSchema = z.object({
    coderId: z.string().uuid(),
    paymentPlanId: z.string().uuid(),
    pricingId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(),
    totalAmount: z.number().min(0),
    classId: z.string().uuid().optional(),
    // New registration fields
    isNewRegistration: z.boolean().optional().default(false),
    registrationFee: z.number().optional().default(0),
    registrationDiscount: z.number().optional().default(0),
    registrationTotal: z.number().optional().default(0),
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

    // Get coder info for invoice creation
    const { data: coder } = await supabase
        .from('users')
        .select('id, full_name, parent_contact_phone, parent_name')
        .eq('id', parsed.data.coderId)
        .single();

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

    // For new registration, class is optional - they will be assigned later
    // For regular payment periods, class is required
    if (!classId && !parsed.data.isNewRegistration) {
        return NextResponse.json({ error: 'Coder tidak memiliki kelas aktif' }, { status: 400 });
    }

    // Only expire existing periods if we have a class (for regular renewals)
    if (classId) {
        // Expire any existing active periods for this coder
        await supabase
            .from('coder_payment_periods')
            .update({ status: 'EXPIRED' })
            .eq('coder_id', parsed.data.coderId)
            .eq('status', 'ACTIVE');
    }

    // Create new payment period (class_id can be null for new registrations)
    const { data, error } = await supabase
        .from('coder_payment_periods')
        .insert({
            coder_id: parsed.data.coderId,
            class_id: classId || null,
            payment_plan_id: parsed.data.paymentPlanId,
            pricing_id: parsed.data.pricingId,
            start_date: parsed.data.startDate,
            end_date: parsed.data.endDate,
            total_amount: parsed.data.totalAmount,
            status: 'ACTIVE',
        } as any)
        .select('*')
        .single();

    if (error) {
        console.error('[Create Payment Period] Error:', error);
        return NextResponse.json({ error: 'Gagal menyimpan periode' }, { status: 500 });
    }

    // =============================================
    // AUTO-CREATE REGISTRATION INVOICE IF NEW CODER
    // =============================================
    let registrationInvoice = null;
    if (parsed.data.isNewRegistration && coder?.parent_contact_phone) {
        try {
            // Get pricing info for class name/level name
            const { data: pricingInfo } = await supabase
                .from('pricing')
                .select('id, level_id, mode, base_price_monthly')
                .eq('id', parsed.data.pricingId)
                .single();

            // Get level name
            let levelName = '-';
            if (pricingInfo?.level_id) {
                const { data: levelData } = await supabase
                    .from('levels')
                    .select('name')
                    .eq('id', pricingInfo.level_id)
                    .single();
                levelName = levelData?.name || '-';
            }

            // Get or create CCR
            const ccr = await getOrCreateCCR(coder.parent_contact_phone, coder.parent_name || coder.full_name);

            if (ccr) {
                const now = new Date();
                const month = now.getMonth() + 1;
                const year = now.getFullYear();

                // Generate invoice number
                const { count } = await supabase
                    .from('invoices' as any)
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`);

                const sequence = (count || 0) + 1;
                const invoiceNumber = `REG-${year}${month.toString().padStart(2, '0')}-${sequence.toString().padStart(4, '0')}`;

                // Due date = 10 days from now
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 10);

                // Total = registration fee + class fee (paket)
                const grandTotal = parsed.data.registrationTotal + parsed.data.totalAmount;

                // Create registration invoice with both fees
                const { data: invoice } = await supabase
                    .from('invoices' as any)
                    .insert({
                        invoice_number: invoiceNumber,
                        ccr_id: ccr.id,
                        parent_phone: coder.parent_contact_phone,
                        parent_name: coder.parent_name || coder.full_name,
                        period_month: month,
                        period_year: year,
                        total_amount: grandTotal,
                        status: 'PENDING',
                        invoice_type: 'REGISTRATION',
                        due_date: dueDate.toISOString()
                    })
                    .select()
                    .single();

                if (invoice) {
                    const invoiceItems = [];

                    // Item 1: Registration fee (if any)
                    if (parsed.data.registrationTotal > 0) {
                        invoiceItems.push({
                            invoice_id: (invoice as any).id,
                            coder_id: parsed.data.coderId,
                            coder_name: coder.full_name,
                            class_name: 'Biaya Pendaftaran',
                            level_name: 'Pendaftaran Baru',
                            base_price: parsed.data.registrationFee,
                            discount_amount: parsed.data.registrationFee - parsed.data.registrationTotal,
                            final_price: parsed.data.registrationTotal
                        });
                    }

                    // Item 2: Class/package fee
                    const modeName = pricingInfo?.mode === 'ONLINE' ? 'Online' : 'Offline';
                    invoiceItems.push({
                        invoice_id: (invoice as any).id,
                        coder_id: parsed.data.coderId,
                        coder_name: coder.full_name,
                        class_name: `Paket Belajar (${modeName})`,
                        level_name: levelName,
                        base_price: parsed.data.totalAmount,
                        discount_amount: 0,
                        final_price: parsed.data.totalAmount,
                        payment_period_id: data.id
                    });

                    // Insert all items
                    await supabase
                        .from('invoice_items' as any)
                        .insert(invoiceItems);

                    registrationInvoice = {
                        id: (invoice as any).id,
                        invoiceNumber: invoiceNumber
                    };
                }
            }
        } catch (invoiceError) {
            console.error('[Create Registration Invoice] Error:', invoiceError);
            // Don't fail the whole request, just log the error
        }
    }

    return NextResponse.json({
        period: data,
        registrationInvoice
    }, { status: 201 });
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
