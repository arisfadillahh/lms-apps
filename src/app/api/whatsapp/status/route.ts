/**
 * GET /api/whatsapp/status - Get WhatsApp connection status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getWhatsAppStatus } from '@/lib/services/whatsappClient';

export async function GET() {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const status = await getWhatsAppStatus();

        return NextResponse.json(status);

    } catch (error) {
        console.error('[API] WhatsApp status error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
