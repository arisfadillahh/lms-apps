/**
 * POST /api/admin/payments/registration/generate
 * Generate registration invoice for a coder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getInvoiceSettings, getOrCreateCCR } from '@/lib/dao/invoicesDao';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { coderId } = body;

        if (!coderId) {
            return NextResponse.json({ error: 'coderId is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Get coder info
        const { data: coder, error: coderError } = await supabase
            .from('users')
            .select('id, full_name, parent_contact_phone, parent_name')
            .eq('id', coderId)
            .eq('role', 'CODER')
            .single();

        if (coderError || !coder) {
            return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
        }

        if (!coder.parent_contact_phone) {
            return NextResponse.json({ error: 'Coder does not have parent phone number' }, { status: 400 });
        }

        // Get settings
        const settings = await getInvoiceSettings();
        if (!settings) {
            return NextResponse.json({ error: 'Invoice settings not configured' }, { status: 400 });
        }

        // Get or create CCR
        const ccr = await getOrCreateCCR(coder.parent_contact_phone, coder.parent_name || coder.full_name);
        if (!ccr) {
            return NextResponse.json({ error: 'Failed to get/create CCR' }, { status: 500 });
        }

        // Check if registration invoice already exists for this CCR
        const { data: existing } = await supabase
            .from('invoices' as any)
            .select('id, invoice_number')
            .eq('ccr_id', ccr.id)
            .eq('invoice_type', 'REGISTRATION')
            .maybeSingle();

        if (existing) {
            return NextResponse.json({
                success: false,
                error: `Invoice pendaftaran sudah ada: ${(existing as any).invoice_number}`
            });
        }

        // Calculate amounts
        const registrationFee = (settings as any).registration_fee || 0;
        const discountPercent = (settings as any).registration_fee_discount_percent || 0;
        const discountAmount = Math.floor(registrationFee * (discountPercent / 100));
        const finalAmount = registrationFee - discountAmount;

        if (finalAmount <= 0) {
            return NextResponse.json({ error: 'Registration fee is 0 or negative' }, { status: 400 });
        }

        // Generate invoice number
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Get sequence for this month
        const { count } = await supabase
            .from('invoices' as any)
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${year}-${month.toString().padStart(2, '0')}-01`);

        const sequence = (count || 0) + 1;
        const invoiceNumber = `REG-${year}${month.toString().padStart(2, '0')}-${sequence.toString().padStart(4, '0')}`;

        // Calculate due date
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (settings.due_days || 10));

        // Create invoice
        const { data: invoice, error: insertError } = await supabase
            .from('invoices' as any)
            .insert({
                invoice_number: invoiceNumber,
                ccr_id: ccr.id,
                parent_phone: coder.parent_contact_phone,
                parent_name: coder.parent_name || coder.full_name,
                period_month: month,
                period_year: year,
                total_amount: finalAmount,
                status: 'PENDING',
                invoice_type: 'REGISTRATION',
                due_date: dueDate.toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('[RegistrationInvoice] Insert error:', insertError);
            return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
        }

        // Create invoice item
        await supabase
            .from('invoice_items' as any)
            .insert({
                invoice_id: (invoice as any).id,
                coder_id: coderId,
                coder_name: coder.full_name,
                class_name: 'Biaya Pendaftaran',
                level_name: '-',
                base_price: registrationFee,
                discount_amount: discountAmount,
                final_price: finalAmount
            });

        return NextResponse.json({
            success: true,
            invoiceNumber,
            amount: finalAmount
        });

    } catch (error) {
        console.error('[RegistrationInvoice] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
