/**
 * GET /api/admin/payments/registration/coders
 * List coders without registration invoice
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getSupabaseAdmin();

        // Get all coders
        const { data: coders, error } = await supabase
            .from('users')
            .select('id, full_name, parent_contact_phone, parent_name, created_at')
            .eq('role', 'CODER')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[RegistrationCoders] Error:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // Get existing registration invoices
        const { data: existingInvoices } = await supabase
            .from('invoices' as any)
            .select('id, parent_phone')
            .eq('invoice_type', 'REGISTRATION');

        const invoicePhones = new Set(
            (existingInvoices || []).map((inv: any) => inv.parent_phone)
        );

        // Mark coders who already have registration invoice
        const codersWithStatus = (coders || []).map((coder) => ({
            ...coder,
            has_registration_invoice: coder.parent_contact_phone
                ? invoicePhones.has(coder.parent_contact_phone)
                : false
        })).filter(c => !c.has_registration_invoice); // Only return those without invoice

        return NextResponse.json({ coders: codersWithStatus });

    } catch (error) {
        console.error('[RegistrationCoders] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
