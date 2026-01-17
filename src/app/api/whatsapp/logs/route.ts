/**
 * GET /api/whatsapp/logs - Get WhatsApp message logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const category = searchParams.get('category');

        const supabase = getSupabaseAdmin();

        let query = supabase
            .from('whatsapp_message_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (category) {
            query = query.eq('category', category as any);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[API] Fetch logs error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch logs' },
                { status: 500 }
            );
        }

        return NextResponse.json({ logs: data });

    } catch (error) {
        console.error('[API] WhatsApp logs error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
