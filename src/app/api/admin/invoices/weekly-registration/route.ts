import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getOrCreateCCR } from '@/lib/dao/invoicesDao';

// Schema for each student registration
const studentRegistrationSchema = z.object({
    name: z.string().min(3), // Just name for now, no account created yet
    pricingId: z.string().uuid(),
    paymentPlanId: z.string().uuid(),
    startDate: z.string(),
    endDate: z.string(), // Calculated on frontend
    totalAmount: z.number().min(0),
    registrationFee: z.number().default(0),
    registrationDiscount: z.number().default(0),
    registrationTotal: z.number().default(0),
    notes: z.string().optional(),
});

// Main request schema
const unifiedRegistrationSchema = z.object({
    parentName: z.string().min(3),
    parentPhone: z.string().min(10),
    students: z.array(studentRegistrationSchema).min(1),
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

    const parsed = unifiedRegistrationSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { parentName, parentPhone, students } = parsed.data;
    const supabase = getSupabaseAdmin();

    try {
        // 1. Get or Create CCR for Parent
        const ccr = await getOrCreateCCR(parentPhone, parentName);
        if (!ccr) throw new Error('Failed to create CCR');

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // 2. ALWAYS Create a New Invoice (Since DB constraint is lifted for REGISTRATION)
        // User wants separate invoices for each registration event.
        const invoice = await createRegistrationInvoice(supabase, ccr, parentPhone, parentName, year, month);
        if (!invoice) throw new Error('Failed to create Invoice');
        const invoiceId = invoice.id;

        let newItemsTotal = 0;

        // 3. Process each student
        for (const student of students) {
            // A. Create Payment Period (Unassigned Coder)
            // Since we don't have a "User" account for the student yet (just name),
            // we technically CANNOT create a `coder_payment_periods` record because it requires `coder_id` (FK to users).

            // USER CLARIFICATION: "nanti kalo udah bayar baru didaftarin LMS".
            // So we DO NOT create payment period yet. We only create INVOICE ITEMS.
            // But invoice items usually link to coder_name.

            // Get Pricing Info for Item Name
            const { data: pricing } = await supabase
                .from('pricing' as any)
                .select('*, levels(name)')
                .eq('id', student.pricingId)
                .single();

            const levelName = (pricing as any)?.levels?.name || 'Program';
            const modeName = (pricing as any)?.mode === 'ONLINE' ? 'Online' : 'Offline';

            // Item 1: Registration Fee
            if (student.registrationTotal > 0) {
                await supabase.from('invoice_items' as any).insert({
                    invoice_id: invoiceId,
                    coder_name: student.name, // String name
                    class_name: 'Biaya Pendaftaran',
                    level_name: 'Pendaftaran Baru',
                    base_price: student.registrationFee,
                    discount_amount: student.registrationFee - student.registrationTotal,
                    final_price: student.registrationTotal
                });
                newItemsTotal += student.registrationTotal;
            }

            // Item 2: Package Fee
            await supabase.from('invoice_items' as any).insert({
                invoice_id: invoiceId,
                coder_name: student.name, // String name
                class_name: `Paket Belajar (${modeName})`,
                level_name: levelName,
                base_price: student.totalAmount,
                discount_amount: 0, // Discount applied at period calculation usually, or passed here?
                // The frontend passes net totalAmount. If we want detailed discount display, we need base vs final.
                // For simplicity, let's assume totalAmount is final.
                final_price: student.totalAmount,
                // payment_period_id: NULL because no period yet
            });
            newItemsTotal += student.totalAmount;
        }

        // 4. Update Invoice Total & Start Date
        const currentTotal = invoice.total_amount || 0;

        // Use the start date from the first student as the invoice period start date
        // This ensures the invoice reflects the actual start date entered in the form
        const invoiceStartDate = students.length > 0 ? students[0].startDate : new Date().toISOString().split('T')[0];

        await supabase
            .from('invoices' as any)
            .update({
                total_amount: currentTotal + newItemsTotal,
                period_start_date: invoiceStartDate
            })
            .eq('id', invoiceId);

        // Fetch final invoice
        const { data: finalInvoice } = await supabase
            .from('invoices' as any)
            .select('*, ccr_numbers(*)')
            .eq('id', invoiceId)
            .single();

        return NextResponse.json({
            success: true,
            invoice: {
                invoice_number: (finalInvoice as any).invoice_number,
                public_url: `${process.env.NEXT_PUBLIC_BASE_URL}/invoice/${(finalInvoice as any).invoice_number}`,
                due_date: (finalInvoice as any).due_date
            }
        });

    } catch (error: any) {
        console.error('[Unified Registration] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// Helpers
async function getPendingRegistrationInvoice(supabase: any, ccrId: string, year: number, month: number) {
    const { data } = await supabase
        .eq('ccr_id', ccrId)
        .eq('invoice_type', 'REGISTRATION')
        // .eq('status', 'PENDING') // Don't filter by status, because unique constraint is (ccr_id, month, year)
        .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`)
        .single();
    return data;
}

async function createRegistrationInvoice(supabase: any, ccr: any, phone: string, name: string, year: number, month: number) {
    // Generate Number
    const { count } = await supabase
        .from('invoices' as any)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`);

    const sequence = (count || 0) + 1;
    const invoiceNumber = `REG-${year}${month.toString().padStart(2, '0')}-${sequence.toString().padStart(4, '0')}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 10);

    const { data, error } = await supabase
        .from('invoices' as any)
        .insert({
            invoice_number: invoiceNumber,
            ccr_id: ccr.id,
            parent_phone: phone,
            parent_name: name,
            period_month: month,
            period_year: year,
            period_start_date: new Date().toISOString().split('T')[0], // Placeholder
            period_end_date: new Date().toISOString().split('T')[0],   // Placeholder
            total_amount: 0,
            status: 'PENDING',
            invoice_type: 'REGISTRATION',
            due_date: dueDate.toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[Unified Registration] Create Invoice Error:', error);
    }

    return data;
}
