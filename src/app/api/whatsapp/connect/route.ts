/**
 * POST /api/whatsapp/connect - Initialize WhatsApp client
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { initializeWhatsApp } from '@/lib/services/whatsappClient';

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

        const result = await initializeWhatsApp();

        return NextResponse.json(result);

    } catch (error) {
        console.error('[API] WhatsApp connect error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
