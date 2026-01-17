/**
 * POST /api/whatsapp/test-send - Test send message to a phone number
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';

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
        const { phone, message } = body;

        // Validate input
        if (!phone || !message) {
            return NextResponse.json(
                { error: 'phone and message are required' },
                { status: 400 }
            );
        }

        console.log('[WhatsApp Test] Sending to:', phone);

        const result = await sendWhatsAppMessage(phone, message);

        console.log('[WhatsApp Test] Result:', result);

        return NextResponse.json(result);

    } catch (error) {
        console.error('[API] WhatsApp test send error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
