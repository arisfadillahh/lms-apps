/**
 * GET /api/invoices/public/[invoiceNumber]
 * Public endpoint to get invoice by invoice number (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceByNumber, getInvoiceSettings } from '@/lib/dao/invoicesDao';

type RouteParams = { params: Promise<{ invoiceNumber: string }> };

export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const { invoiceNumber } = await params;

        if (!invoiceNumber) {
            return NextResponse.json(
                { error: 'Invoice number is required' },
                { status: 400 }
            );
        }

        // Get invoice
        const invoice = await getInvoiceByNumber(invoiceNumber);

        if (!invoice) {
            return NextResponse.json(
                { error: 'Invoice not found' },
                { status: 404 }
            );
        }

        // Get settings for bank info
        const settings = await getInvoiceSettings();

        return NextResponse.json({
            invoice,
            bankInfo: settings ? {
                bank_name: settings.bank_name,
                bank_account_number: settings.bank_account_number,
                bank_account_holder: settings.bank_account_holder,
                admin_whatsapp_number: settings.admin_whatsapp_number
            } : null
        });

    } catch (error) {
        console.error('[API] Get public invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
