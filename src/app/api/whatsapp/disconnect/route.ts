/**
 * POST /api/whatsapp/disconnect - Disconnect WhatsApp client
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { disconnectWhatsApp } from '@/lib/services/whatsappClient';

export async function POST() {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const success = await disconnectWhatsApp();

        return NextResponse.json({ success });

    } catch (error) {
        console.error('[API] WhatsApp disconnect error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
