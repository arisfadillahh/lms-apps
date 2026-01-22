/**
 * POST /api/whatsapp/reset - Force reset WhatsApp session
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { forceResetWhatsApp } from '@/lib/services/whatsappClient';

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

        const result = await forceResetWhatsApp();

        return NextResponse.json(result);

    } catch (error) {
        console.error('[API] WhatsApp reset error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
