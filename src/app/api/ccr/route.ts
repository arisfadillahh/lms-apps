/**
 * CCR Assignment API Routes
 * GET /api/ccr - List all CCRs
 * GET /api/ccr/unassigned - Get coders without CCR
 * GET /api/ccr/next - Get next available CCR code
 * POST /api/ccr/assign - Assign CCR to parent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import {
    getAllCCRs,
    getCodersWithoutCCR,
    getNextAvailableCCR,
    assignCCRToParent
} from '@/lib/dao/invoicesDao';

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'unassigned') {
            const groups = await getCodersWithoutCCR();
            const nextCCR = await getNextAvailableCCR();
            return NextResponse.json({ groups, nextCCR });
        }

        if (action === 'next') {
            const nextCCR = await getNextAvailableCCR();
            return NextResponse.json({ nextCCR });
        }

        // Default: list all CCRs
        const ccrs = await getAllCCRs();
        return NextResponse.json({ ccrs });

    } catch (error) {
        console.error('[API] CCR error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { parent_phone, ccr_code, parent_name } = body;

        // Validate
        if (!parent_phone || !ccr_code) {
            return NextResponse.json(
                { error: 'parent_phone and ccr_code are required' },
                { status: 400 }
            );
        }

        // Validate CCR format
        if (!/^CCR[0-9]{3,}$/.test(ccr_code)) {
            return NextResponse.json(
                { error: 'Invalid CCR format. Must be CCR followed by at least 3 digits (e.g., CCR001)' },
                { status: 400 }
            );
        }

        // Assign CCR
        const result = await assignCCRToParent(parent_phone, ccr_code, parent_name);

        if (!result) {
            return NextResponse.json(
                { error: 'Failed to assign CCR. It may already be in use.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true, ccr: result });

    } catch (error) {
        console.error('[API] CCR assign error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
