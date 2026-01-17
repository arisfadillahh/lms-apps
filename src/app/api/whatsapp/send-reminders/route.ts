/**
 * POST /api/whatsapp/send-reminders - Send invoice reminders via WhatsApp
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { sendInvoiceReminders } from '@/lib/services/whatsappClient';

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
        const { month, year } = body;

        // Validate input
        if (!month || !year) {
            return NextResponse.json(
                { error: 'Month and year are required' },
                { status: 400 }
            );
        }

        if (month < 1 || month > 12) {
            return NextResponse.json(
                { error: 'Month must be between 1 and 12' },
                { status: 400 }
            );
        }

        // Send reminders
        const result = await sendInvoiceReminders(month, year);

        return NextResponse.json(result);

    } catch (error) {
        console.error('[API] Send reminders error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
