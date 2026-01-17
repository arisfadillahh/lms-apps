/**
 * POST /api/whatsapp/send-single-reminder - Send a single invoice reminder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { sendSingleInvoiceReminder } from '@/lib/services/whatsappClient';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { invoiceId } = body;

        // Validate input
        if (!invoiceId) {
            return NextResponse.json(
                { error: 'Invoice ID is required' },
                { status: 400 }
            );
        }

        // Send reminder
        const result = await sendSingleInvoiceReminder(invoiceId);

        return NextResponse.json(result);

    } catch (error) {
        console.error('[API] Send single reminder error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
