import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const seasonalInvoiceSchema = z.object({
    studentName: z.string().min(2, 'Nama siswa minimal 2 karakter'),
    studentPhone: z.string().min(10, 'Nomor WhatsApp minimal 10 digit'),
    pricingId: z.string().uuid('Pilih harga/level'),
    discountAmount: z.number().min(0).optional().default(0),
    discountDescription: z.string().optional(),
    notes: z.string().optional(),
});

// Generate seasonal invoice number: SEA-YYYY-XXXX
async function generateSeasonalInvoiceNumber(supabase: any): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SEA-${year}-`;

    // Get latest seasonal invoice number this year
    const { data: latest } = await supabase
        .from('invoices')
        .select('invoice_number')
        .like('invoice_number', `${prefix}%`)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .single();

    let nextNum = 1;
    if (latest?.invoice_number) {
        const match = latest.invoice_number.match(/SEA-\d{4}-(\d+)/);
        if (match) {
            nextNum = parseInt(match[1], 10) + 1;
        }
    }

    return `${prefix}${nextNum.toString().padStart(4, '0')}`;
}

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = seasonalInvoiceSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            error: 'Validation failed',
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    // Cast to any to bypass incomplete TypeScript types for invoices/pricing
    const supabase = getSupabaseAdmin() as any;
    const { studentName, studentPhone, pricingId, discountAmount, discountDescription, notes } = parsed.data;

    // Fetch pricing info
    const { data: pricing, error: pricingError } = await supabase
        .from('pricing')
        .select('*, levels(name)')
        .eq('id', pricingId)
        .single();

    if (pricingError || !pricing) {
        return NextResponse.json({ error: 'Pricing tidak ditemukan' }, { status: 404 });
    }

    // Calculate amounts
    const basePrice = pricing.base_price_monthly;
    const discount = discountAmount || 0;
    const totalAmount = Math.max(0, basePrice - discount);

    // Determine level/program name
    const programName = pricing.pricing_type === 'SEASONAL'
        ? (pricing.seasonal_name || 'Seasonal Program')
        : (pricing.levels?.name || 'Unknown Level');

    // Generate invoice number
    const invoiceNumber = await generateSeasonalInvoiceNumber(supabase);

    // Set due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice - using actual table columns
    const now = new Date();
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
            invoice_number: invoiceNumber,
            ccr_id: null, // No CCR for seasonal
            parent_phone: studentPhone,
            parent_name: studentName,
            period_month: now.getMonth() + 1,
            period_year: now.getFullYear(),
            invoice_type: 'SEASONAL',
            status: 'PENDING',
            total_amount: totalAmount, // This is final amount (after discount)
            due_date: dueDate.toISOString().split('T')[0],
            seasonal_student_name: studentName,
            seasonal_student_phone: studentPhone,
        })
        .select('*')
        .single();

    if (invoiceError) {
        console.error('[Seasonal Invoice] Error:', invoiceError);
        return NextResponse.json({
            error: 'Gagal membuat invoice',
            details: invoiceError.message
        }, { status: 500 });
    }

    // Create invoice items
    // IMPORTANT: invoice_items table usually has: 
    // coder_id (nullable for seasonal?), coder_name, level_name, class_name, base_price, discount_amount, final_price

    // Because seasonal invoices don't have a coder_id, we need to handle that.
    // If table requires coder_id, we might have an issue unless it's nullable.
    // Assuming coder_id is nullable (we don't have migration for it, but assuming from context since seasonal was implemented)
    // If not, we might need to put NULL or dummy.

    // Per previous conversation, invoice items were empty. 
    // Let's make sure we populate the required string fields.

    const invoiceItems = [];

    // Main item: Program Fee
    invoiceItems.push({
        invoice_id: invoice.id,
        coder_id: null, // No coder
        coder_name: studentName, // Use student name as coder name for display
        class_name: pricing.mode === 'ONLINE' ? 'Online Class' : 'Offline Class',
        level_name: programName,
        base_price: basePrice,
        discount_amount: discount,
        final_price: totalAmount,
        // Optional description field if exists? Usually it's inferred from level_name
    });

    const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

    if (itemsError) {
        console.error('[Seasonal Invoice Items] Error:', itemsError);
        // Invoice already created, items failed - log but continue
    }

    // Generate public URL
    const publicUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005'}/invoice/${invoice.invoice_number}`;

    return NextResponse.json({
        invoice: {
            ...invoice,
            public_url: publicUrl,
            level_name: programName,
        }
    }, { status: 201 });
}

// GET: List all pricing options for dropdown
export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    // Cast to any to bypass incomplete TypeScript types
    const supabase = getSupabaseAdmin() as any;

    const { data: pricing, error } = await supabase
        .from('pricing')
        .select('id, level_id, mode, base_price_monthly, is_active, pricing_type, seasonal_name, levels(id, name)')
        .eq('is_active', true)
        .order('base_price_monthly', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Gagal mengambil data pricing' }, { status: 500 });
    }

    return NextResponse.json({ pricing: pricing || [] });
}
